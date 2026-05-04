import { useCallback } from 'react';
import { apiService } from '../../services/apiService';

import { Seller } from '../../types';

// Events/notificaciones desactivadas temporalmente junto con SSE
export function useNotifications(_globalPin: string | null, _currentSeller: Seller | null, setNotifications: (n: any[]) => void, setUnreadNotifications: (c: number) => void) {
  // Desactivado temporalmente - retorna silenciosamente para evitar spam en consola
  const fetchNotifications = useCallback(async () => {
    setNotifications([]);
    setUnreadNotifications(0);
    return;
    /* Código comentado temporalmente:
    if (!globalPin || !currentSeller) return;
    try {
      console.log('📡 Syncing notifications from server...');

      // Usar endpoint combinado: eventos + unread en una sola llamada
      const result = await apiService.syncEvents(globalPin);

      if (result) {
        // Server already filters by user_id (broadcast + personal)
        setNotifications(result.events);
        setUnreadNotifications(result.unread);
      } else {
        // Fallback a método antiguo si el nuevo falla
        const data = await apiService.getEvents(undefined, globalPin);
        const currentUserId = parseInt(currentSeller.id, 10);
        const filtered = data.filter((n: any) => n.user_id === 0 || n.user_id === currentUserId);
        setNotifications(filtered);
        const unread = await apiService.getUnreadCount(globalPin);
        setUnreadNotifications(unread);
      }
    } catch (e) {
      console.warn('Notification sync paused:', e instanceof Error ? e.message : String(e));
    }
    */
  }, [setNotifications, setUnreadNotifications]);

  // Desactivado temporalmente - retorna silenciosamente
  const sendNotification = useCallback(async (_toUserId: number, _content: string, _type: 'message' | 'notification' = 'notification', _currentSellerId?: string, _currentSellerName?: string) => {
    return false;
    /* Código comentado temporalmente:
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
        title: type === 'message' ? `Mensaje de ${currentSellerName || 'Vendedor'}` : 'Notificacón de TecnoGafas',
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
    */
  }, []);

  return { fetchNotifications, sendNotification };
}
