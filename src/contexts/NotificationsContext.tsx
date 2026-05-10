import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { PushNotifications } from '@capacitor/push-notifications';
import type React from 'react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNotifications as useNotificationsHook } from '../hooks/context/useNotifications';
import { apiService } from '../services/apiService';
import type { AppNotification, DeployEvent } from '../types';
import { useAuth } from './AuthContext';
import { useConnection } from './ConnectionContext';

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadNotifications: number;
  deployEvent: DeployEvent | null;
  fetchNotifications: () => Promise<void>;
  sendNotification: (
    toUserId: number,
    content: string,
    type?: 'message' | 'notification',
  ) => Promise<boolean>;
  markAllNotificationsAsRead: () => Promise<void>;
  markNotificationAsShown: (id: number) => void;
  hasNotificationBeenShown: (id: number) => boolean;
  setDeployNotification: (event: DeployEvent) => void;
  initializePushNotifications: () => Promise<void>;
  setNotifications: (notifications: AppNotification[]) => void;
  setUnreadNotifications: React.Dispatch<React.SetStateAction<number>>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const MAX_SHOWN_NOTIFICATIONS = 100;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { globalPin, currentSeller, supabaseUser } = useAuth();
  const { isOnline } = useConnection();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [deployEvent, setDeployEvent] = useState<DeployEvent | null>(null);
  const shownNotificationIdsRef = useRef<Set<number>>(new Set());

  const { fetchNotifications, sendNotification: sendNotificationBase } = useNotificationsHook(
    globalPin,
    currentSeller,
    setNotifications,
    setUnreadNotifications,
  );

  useEffect(() => {
    if (!supabaseUser) {
      setUnreadNotifications(0);
    }
  }, [supabaseUser]);

  const sendNotification = useCallback(
    async (
      toUserId: number,
      content: string,
      type: 'message' | 'notification' = 'notification',
    ) => {
      return sendNotificationBase(toUserId, content, type, currentSeller?.id, currentSeller?.name);
    },
    [sendNotificationBase, currentSeller],
  );

  const markAllNotificationsAsRead = useCallback(async () => {
    if (!globalPin || !currentSeller || notifications.length === 0) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    await Promise.all(unread.map((n) => apiService.ackEvent(n.id, globalPin).catch(() => null)));
  }, [globalPin, currentSeller, notifications]);

  const markNotificationAsShown = useCallback((id: number) => {
    const newSet = shownNotificationIdsRef.current;
    newSet.add(id);
    if (newSet.size > MAX_SHOWN_NOTIFICATIONS) {
      const iterator = newSet.values();
      const toDelete = [];
      for (let i = 0; i < newSet.size - MAX_SHOWN_NOTIFICATIONS; i++) {
        const value = iterator.next().value;
        if (value !== undefined) toDelete.push(value);
      }
      toDelete.forEach((v) => newSet.delete(v));
    }
  }, []);

  const hasNotificationBeenShown = useCallback((id: number) => {
    return shownNotificationIdsRef.current.has(id);
  }, []);

  const initializePushNotifications = useCallback(async () => {
    if (Capacitor.getPlatform() === 'web') return;
    try {
      await LocalNotifications.requestPermissions();
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt')
        permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive !== 'granted') return;

      await PushNotifications.register();
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const eventId = notification?.data?.event_id || notification?.data?.id;
        if (eventId && hasNotificationBeenShown(eventId)) return;
        if (eventId) markNotificationAsShown(eventId);
        setUnreadNotifications((prev) => prev + 1);
      });
    } catch (e) {
      console.error('Error initializing Push Notifications', e);
    }
  }, [hasNotificationBeenShown, markNotificationAsShown]);

  useEffect(() => {
    initializePushNotifications();
  }, [initializePushNotifications]);

  const setDeployNotification = (event: DeployEvent) => {
    setDeployEvent(event);
    setTimeout(() => setDeployEvent(null), 10000);
  };

  const globalChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!supabaseUser || !isOnline) return;

    const setupGlobalNotifications = async () => {
      try {
        if (globalChannelRef.current) {
          await apiService.unsubscribeSupabase(globalChannelRef.current);
          globalChannelRef.current = null;
        }

        const { data: conv, error: convError } = await apiService.getSupabaseNotificationChannel();
        if (convError || !conv) return;

        const { data: member, error: memberError } = await apiService.getSupabaseMemberStatus(
          conv.id,
          supabaseUser.id,
        );
        if (member && !memberError) {
          setUnreadNotifications(member.unread_count || 0);
        }

        globalChannelRef.current = await apiService.subscribeToSupabaseTable(
          'messages',
          `conversation_id=eq.${conv.id}`,
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setUnreadNotifications((prev) => prev + 1);
              if (window.location.pathname !== '/chat') {
                const msg = payload.new as { content?: string; id?: number };
                LocalNotifications.schedule({
                  notifications: [
                    {
                      title: 'Nueva Notificación',
                      body: msg.content || 'Tienes un nuevo mensaje del sistema',
                      id: Date.now(),
                      extra: { event_id: msg.id },
                    },
                  ],
                });
              }
            }
          },
        );
      } catch (err) {
        console.error('Error setting up global notifications:', err);
      }
    };

    setupGlobalNotifications();

    return () => {
      if (globalChannelRef.current) {
        apiService.unsubscribeSupabase(globalChannelRef.current);
        globalChannelRef.current = null;
      }
    };
  }, [supabaseUser, isOnline]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadNotifications,
        deployEvent,
        fetchNotifications,
        sendNotification,
        markAllNotificationsAsRead,
        markNotificationAsShown,
        hasNotificationBeenShown,
        setDeployNotification,
        initializePushNotifications,
        setNotifications,
        setUnreadNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const context = useContext(NotificationsContext);
  if (!context)
    throw new Error('useNotificationsContext must be used within NotificationsProvider');
  return context;
}
