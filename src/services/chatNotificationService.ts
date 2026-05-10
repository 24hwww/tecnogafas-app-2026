// ============================================================================
// SERVICIO DE NOTIFICACIONES DE CHAT PARA PEDIDOS
// Crea notificaciones automáticas cuando se generan pedidos exitosos
// ============================================================================

import { supabase } from '../modules/chat/lib/supabase';
import type { Order, Seller } from '../types';

interface OrderNotificationData {
  order_id: string;
  order_number: string;
  seller_name: string;
  client_name: string;
  total: number;
  items_count: number;
  url?: string;
}

/**
 * Crea una notificación en el chat cuando un pedido se crea exitosamente
 */
export async function createOrderNotification(
  order: Order,
  seller: Seller,
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Obtener o crear el canal de notificaciones
    const notificationChannel = await getOrCreateNotificationChannel();

    if (!notificationChannel) {
      throw new Error('No se pudo obtener el canal de notificaciones');
    }

    // 2. Preparar datos de la notificación
    const notificationData: OrderNotificationData = {
      order_id: order.id?.toString() || 'unknown',
      order_number: `#${order.id}`,
      seller_name: seller.name || 'Vendedor',
      client_name: order.clientName || 'Cliente',
      total: order.total || 0,
      items_count: order.items?.length || 0,
      url: `/orders/${order.id}`,
    };

    // 3. Crear mensaje de notificación en el chat
    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: notificationChannel.id,
      type: 'order',
      content: `🛒 Nuevo pedido ${notificationData.order_number}`,
      metadata: {
        notification_type: 'new_order',
        order_data: notificationData,
      },
      // Ensure user_id is either a valid UUID or null for system notifications
      user_id: seller.id && /^\d+$/.test(seller.id) ? null : seller.id?.toString(),
    } as never);

    if (messageError) {
      throw messageError;
    }

    // 4. Actualizar última actividad del canal
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
      } as never)
      .eq('id', notificationChannel.id);

    console.log(
      `[ChatNotification] Notificación creada para pedido ${notificationData.order_number}`,
    );

    return { success: true };
  } catch (error) {
    console.error('[ChatNotification] Error al crear notificación:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Obtiene o crea el canal de notificaciones
 */
async function getOrCreateNotificationChannel(): Promise<{ id: string } | null> {
  try {
    // Primero intentar obtener el canal existente
    const { data: existingChannel } = await supabase
      .from('conversations')
      .select('id')
      .eq('slug', 'notificaciones')
      .maybeSingle();

    if (existingChannel) {
      return existingChannel;
    }

    // Si no existe, crear el canal
    const { data: newChannel, error: createError } = await supabase
      .from('conversations')
      .insert({
        type: 'channel',
        name: 'Notificaciones',
        slug: 'notificaciones',
        description: 'Canal de notificaciones del sistema',
        is_private: false,
        created_by: 'system',
        metadata: {
          auto_notifications: true,
        },
      } as never)
      .select('id')
      .single();

    if (createError) {
      throw createError;
    }

    return newChannel;
  } catch (error) {
    console.error('[ChatNotification] Error al obtener/crear canal:', error);
    return null;
  }
}

/**
 * Crea una notificación de actualización de estado de pedido
 */
export async function createOrderStatusNotification(
  order: Order,
  newStatus: string,
  seller: Seller,
): Promise<{ success: boolean; error?: string }> {
  try {
    const notificationChannel = await getOrCreateNotificationChannel();

    if (!notificationChannel) {
      throw new Error('No se pudo obtener el canal de notificaciones');
    }

    const statusEmojis: Record<string, string> = {
      pending: '⏳',
      processing: '🔄',
      completed: '✅',
      cancelled: '❌',
    };

    const emoji = statusEmojis[newStatus] || '📋';

    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: notificationChannel.id,
      type: 'alert',
      content: `${emoji} Pedido #${order.id} actualizado: ${newStatus}`,
      metadata: {
        notification_type: 'order_status_update',
        alert_data: {
          level: 'info',
          title: 'Actualización de Pedido',
          order_id: order.id?.toString(),
          old_status: order.status,
          new_status: newStatus,
          action: {
            label: 'Ver Pedido',
            url: `/orders/${order.id}`,
          },
        },
      },
      // Ensure user_id is either a valid UUID or null for system notifications
      user_id: seller.id && /^\d+$/.test(seller.id) ? null : seller.id?.toString(),
    } as never);

    if (messageError) {
      throw messageError;
    }

    return { success: true };
  } catch (error) {
    console.error('[ChatNotification] Error al crear notificación de estado:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Envía una notificación personalizada al chat
 */
export async function sendCustomNotification(
  title: string,
  message: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info',
  metadata?: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const notificationChannel = await getOrCreateNotificationChannel();

    if (!notificationChannel) {
      throw new Error('No se pudo obtener el canal de notificaciones');
    }

    const typeEmojis: Record<string, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅',
    };

    const emoji = typeEmojis[type];

    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: notificationChannel.id,
      type: 'alert',
      content: `${emoji} ${title}`,
      metadata: {
        notification_type: 'custom',
        alert_data: {
          level: type,
          title,
          message,
          ...metadata,
        },
      },
      user_id: 'system',
    } as never);

    if (messageError) {
      throw messageError;
    }

    return { success: true };
  } catch (error) {
    console.error('[ChatNotification] Error al enviar notificación personalizada:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}
