import { useCallback } from 'react';
import { apiService } from '../../services/apiService';

export function useNotifications(globalPin: string | null, setNotifications: (n: any[]) => void, setUnreadNotifications: (c: number) => void) {
  const fetchNotifications = useCallback(async () => {
    if (!globalPin) return;
    try {
      console.log('📡 Syncing notifications from server...');
      const data = await apiService.getEvents(undefined, globalPin);
      setNotifications(data);
      const unread = await apiService.getUnreadCount(globalPin);
      setUnreadNotifications(unread);
    } catch (e) {
      console.warn('Notification sync paused:', e instanceof Error ? e.message : String(e));
    }
  }, [globalPin, setNotifications, setUnreadNotifications]);

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
