// ============================================================================
// HOOK: useTyping
// Indicador de "escribiendo..." con debounce
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase, channelManager } from '../lib/supabase';
import type { TypingStatus, Profile, TypingUser } from '../types';
import { getTypingUsers, setTypingStatus, clearTypingStatus, cleanupExpiredTyping } from '../stores/chatDatabase';
import { getProfile } from '../stores/chatDatabase';

interface UseTypingOptions {
  conversationId: string | null;
  currentUserId: string | null;
}

interface UseTypingReturn {
  typingUsers: TypingUser[];
  startTyping: () => void;
  stopTyping: () => void;
  isTyping: boolean;
}

const TYPING_DEBOUNCE = 300; // ms antes de enviar "typing"
const TYPING_DURATION = 30000; // 30 segundos de duración
const TYPING_CLEANUP_INTERVAL = 10000; // Limpiar cada 10 segundos

export function useTyping({
  conversationId,
  currentUserId,
}: UseTypingOptions): UseTypingReturn {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // ENVIAR ESTADO DE TYPING
  // ============================================================================

  const sendTypingStatus = useCallback(
    async (isTypingNow: boolean) => {
      if (!conversationId || !currentUserId) return;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + TYPING_DURATION);

      try {
        if (isTypingNow) {
          await supabase.from('typing_status').upsert([{
            conversation_id: conversationId,
            user_id: currentUserId,
            started_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          }] as unknown as never[]);

          // Guardar en cache local
          await setTypingStatus({
            id: '',
            conversation_id: conversationId,
            user_id: currentUserId,
            started_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          });
        } else {
          await supabase
            .from('typing_status')
            .delete()
            .eq('conversation_id', conversationId)
            .eq('user_id', currentUserId);

          await clearTypingStatus(conversationId, currentUserId);
        }
      } catch (err) {
        // Silencioso - no es crítico
        console.debug('[useTyping] Error:', err);
      }
    },
    [conversationId, currentUserId]
  );

  // ============================================================================
  // INICIAR TYPING (con debounce)
  // ============================================================================

  const startTyping = useCallback(() => {
    if (!conversationId || !currentUserId) return;

    setIsTyping(true);

    // Clear debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce antes de enviar
    debounceRef.current = setTimeout(() => {
      sendTypingStatus(true);
    }, TYPING_DEBOUNCE);

    // Auto-stop después de inactividad
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 5000); // Stop si no escribe por 5 segundos
  }, [conversationId, currentUserId, sendTypingStatus]);

  // ============================================================================
  // DETENER TYPING
  // ============================================================================

  const stopTyping = useCallback(() => {
    setIsTyping(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    sendTypingStatus(false);
  }, [sendTypingStatus]);

  // ============================================================================
  // CARGAR USUARIOS ESCRIBIENDO
  // ============================================================================

  const loadTypingUsers = useCallback(async () => {
    if (!conversationId || !currentUserId) {
      setTypingUsers([]);
      return;
    }

    try {
      // Limpiar expirados
      await cleanupExpiredTyping();

      // Cargar desde cache
      const cached = await getTypingUsers(conversationId, currentUserId);
      if (cached.length > 0) {
        const enriched = await enrichTypingUsers(cached);
        setTypingUsers(enriched);
      }

      // Fetch desde servidor
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('typing_status')
        .select('*')
        .eq('conversation_id', conversationId)
        .neq('user_id', currentUserId)
        .gt('expires_at', now);

      if (error) throw error;

      if (data) {
        const enriched = await enrichTypingUsers(data as TypingStatus[]);
        setTypingUsers(enriched);
      }
    } catch (err) {
      console.debug('[useTyping] Error loading:', err);
    }
  }, [conversationId, currentUserId]);

  // ============================================================================
  // ENRIQUECER USUARIOS CON PERFILES
  // ============================================================================

  const enrichTypingUsers = async (statuses: TypingStatus[]): Promise<TypingUser[]> => {
    const userIds = [...new Set(statuses.map((s) => s.user_id))];
    const profiles = await Promise.all(userIds.map((id) => getProfile(id)));
    const profileMap = new Map(profiles.filter(Boolean).map((p) => [p!.id, p!]));

    return statuses.map((s) => ({
      ...s,
      user: profileMap.get(s.user_id),
    }));
  };

  // ============================================================================
  // REALTIME SUBSCRIPTION
  // ============================================================================

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const channelName = `typing:${conversationId}`;
    const channel = channelManager.getChannel(channelName);

    // @ts-ignore
    if (channel.state === 'closed' || channel.state === 'errored') {
      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'typing_status',
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload: RealtimePostgresChangesPayload<TypingStatus>) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const status = payload.new;
              if (status.user_id === currentUserId) return;

              const profile = await getProfile(status.user_id);
              setTypingUsers((prev) => {
                const filtered = prev.filter((u) => u.user_id !== status.user_id);
                return [...filtered, { ...status, user: profile }];
              });
            } else if (payload.eventType === 'DELETE') {
              const deleted = payload.old;
              setTypingUsers((prev) => prev.filter((u) => u.user_id !== deleted.user_id));
            }
          }
        );
    }

    channelManager.subscribe(channelName, {
      onError: (err) => {
        console.debug('[Realtime] Typing error:', err);
      },
    });

    return () => {
      channelManager.unsubscribe(channelName);
    };
  }, [conversationId, currentUserId]);

  // ============================================================================
  // CLEANUP EXPIRADOS PERIÓDICO
  // ============================================================================

  useEffect(() => {
    if (!conversationId) return;

    cleanupIntervalRef.current = setInterval(() => {
      cleanupExpiredTyping();
      loadTypingUsers();
    }, TYPING_CLEANUP_INTERVAL);

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [conversationId, loadTypingUsers]);

  // ============================================================================
  // CARGA INICIAL Y CLEANUP
  // ============================================================================

  useEffect(() => {
    if (conversationId && currentUserId) {
      loadTypingUsers();
    } else {
      setTypingUsers([]);
    }

    return () => {
      // Limpiar typing al desmontar
      if (isTyping && conversationId && currentUserId) {
        sendTypingStatus(false);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [conversationId, currentUserId, loadTypingUsers]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
    isTyping,
  };
}
