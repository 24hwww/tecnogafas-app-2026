import { useCallback } from 'react';
import { apiService } from '../../services/apiService';

import { Seller } from '../../types';

export function useNotifications(globalPin: string | null, currentSeller: Seller | null, setNotifications: (n: any[]) => void, setUnreadNotifications: (c: number) => void) {
  const fetchNotifications = useCallback(async () => {
    if (!globalPin || !currentSeller) return;
    try {
      console.log('📡 Syncing notifications from server...');
      const data = await apiService.getEvents(undefined, globalPin);
      // Filter: only show events for current user (0 = broadcast to all)
      const currentUserId = parseInt(currentSeller.id, 10);
      const filtered = data.filter((n: any) => n.user_id === 0 || n.user_id === currentUserId);
      setNotifications(filtered);
      const unread = await apiService.getUnreadCount(globalPin);
      setUnreadNotifications(unread);
    } catch (e) {
      console.warn('Notification sync paused:', e instanceof Error ? e.message : String(e));
    }
  }, [globalPin, currentSeller, setNotifications, setUnreadNotifications]);

  const sendNotification = useCallback(async (toUserId: number, content: string, type: 'message' | 'notification' = 'notification', currentSellerId?: string, currentSellerName?: string) => {
    if (!globalPin || !currentSellerId) {
        console.error('Missing globalPin or currentSellerId');
        return false;
    }

    const userId = parseInt(String(toUserId), 10);
    const senderId = parseInt(String(currentSellerId), 10);

    if (isNaN(userId) || isNaN(senderId)) {
      console.error('Invalid user IDs:', { userId, senderId });
      return false;
    }

    const payload = {
      user_id: userId === 0 ? senderId : userId,
      type: type,
      from_id: senderId,
      content: { 
        title: type === 'message' ? `Mensaje de ${currentSellerName || 'Vendedor'}` : 'Notificación de TecnoGafas',
        body: content 
      },
      read: 0
    };

    try {
      await apiService.createEvent(payload, globalPin);
      return true;
    } catch (e) {
      console.error('Error sending notification', e);
      return false;
    }
  }, [globalPin]);

  return { fetchNotifications, sendNotification };
}
