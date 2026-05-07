/**
 * Servicio de sincronización de pedidos pendientes
 * Gestiona pedidos que fallaron al enviar a la API, guardándolos en Supabase
 * y reintentando el envío periódicamente.
 */

import { supabase } from '../modules/chat/lib/supabase';
import type { CartItem, Client } from '../types';
import { apiService } from './apiService';

export interface PendingOrderData {
  id?: string;
  sellerId: string;
  sellerName?: string;
  client: Client;
  items: CartItem[];
  details: {
    commit?: string;
    discount?: number | string;
    recargo?: number | string;
    transport?: string;
    methodpay?: string;
    otheremail?: string;
    iva?: number | string;
  };
  status?: 'pending' | 'syncing' | 'failed' | 'completed';
  attemptCount?: number;
  lastError?: string;
  createdAt?: string;
  syncedOrderId?: string;
}

export interface PendingOrderRecord extends PendingOrderData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Guardar un pedido pendiente en Supabase
 */
export async function savePendingOrder(
  sellerId: string,
  client: Client,
  items: CartItem[],
  details: PendingOrderData['details'],
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const { data, error } = await (supabase as any)
      .from('pending_orders')
      .insert({
        seller_id: sellerId,
        seller_name: '',
        client_id: client.id,
        client_data: client,
        items: items,
        details: details,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[PendingOrdersSync] Error saving pending order:', error);
      return { success: false, error: error.message };
    }

    const record = data as unknown as { id: string };
    console.log('[PendingOrdersSync] Pending order saved:', record.id);
    return { success: true, orderId: record.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[PendingOrdersSync] Exception saving pending order:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Obtener pedidos pendientes del vendedor actual
 */
export async function getPendingOrders(
  sellerId: string,
  status?: ('pending' | 'syncing' | 'failed')[],
): Promise<PendingOrderRecord[]> {
  try {
    let query = supabase
      .from('pending_orders')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    if (status && status.length > 0) {
      query = query.in('status', status);
    } else {
      query = query.in('status', ['pending', 'failed']);
    }

    const { data, error } = await (query as any);

    if (error) {
      console.error('[PendingOrdersSync] Error fetching pending orders:', error);
      return [];
    }

    const records = data as unknown as Array<Record<string, unknown>>;
    return records?.map(mapSupabaseRecord) || [];
  } catch (err) {
    console.error('[PendingOrdersSync] Exception fetching pending orders:', err);
    return [];
  }
}

/**
 * Intentar sincronizar un pedido pendiente con la API
 */
export async function syncPendingOrder(
  order: PendingOrderRecord,
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  console.log(
    `[PendingOrdersSync] Syncing order ${order.id} (attempt ${order.attemptCount || 0 + 1})`,
  );

  try {
    // Marcar como syncing
    await updateOrderStatus(order.id, 'syncing');

    // Intentar crear el pedido en la API
    const result = await apiService.createOrder(
      order.client.id,
      order.items.map((item) => ({
        id: item.id,
        vid: item.vid,
        price: item.price,
        quantity: item.quantity,
      })),
      order.details,
      order.sellerId,
    );

    if (result.success && result.orderId) {
      // Éxito: marcar como completado
      await markOrderCompleted(order.id, result.orderId, result);
      console.log(`[PendingOrdersSync] Order ${order.id} synced successfully as ${result.orderId}`);
      return { success: true, orderId: result.orderId };
    } else {
      // Falló: incrementar intento
      const errorMsg = result.message || 'API error';
      await incrementAttempt(order.id, errorMsg);
      console.log(`[PendingOrdersSync] Order ${order.id} failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error during sync';
    await incrementAttempt(order.id, msg);
    console.error(`[PendingOrdersSync] Exception syncing order ${order.id}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Sincronizar todos los pedidos pendientes
 */
export async function syncAllPendingOrders(
  sellerId: string,
  onProgress?: (current: number, total: number, orderId: string) => void,
): Promise<{
  success: number;
  failed: number;
  total: number;
}> {
  const orders = await getPendingOrders(sellerId, ['pending', 'failed']);

  if (orders.length === 0) {
    return { success: 0, failed: 0, total: 0 };
  }

  console.log(`[PendingOrdersSync] Starting sync of ${orders.length} pending orders`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];

    onProgress?.(i + 1, orders.length, order.id);

    // Verificar si debe reintentar según backoff
    if (!shouldRetry(order)) {
      console.log(`[PendingOrdersSync] Order ${order.id} skipped (backoff)`);
      continue;
    }

    const result = await syncPendingOrder(order);

    if (result.success) {
      success++;
    } else {
      failed++;
    }

    // Pequeña pausa entre pedidos para no saturar la API
    if (i < orders.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(
    `[PendingOrdersSync] Sync complete: ${success} success, ${failed} failed, ${orders.length} total`,
  );
  return { success, failed, total: orders.length };
}

/**
 * Eliminar un pedido pendiente
 */
export async function deletePendingOrder(orderId: string, sellerId: string): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('pending_orders')
      .delete()
      .eq('id', orderId)
      .eq('seller_id', sellerId);

    if (error) {
      console.error('[PendingOrdersSync] Error deleting pending order:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[PendingOrdersSync] Exception deleting pending order:', err);
    return false;
  }
}

/**
 * Actualizar un pedido pendiente (útil para editar antes de reenviar)
 */
export async function updatePendingOrder(
  orderId: string,
  updates: Partial<PendingOrderData>,
): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.client)
      updateData.client_data = updates.client as unknown as Record<string, unknown>;
    if (updates.items) updateData.items = updates.items as unknown as Record<string, unknown>[];
    if (updates.details) updateData.details = updates.details as unknown as Record<string, unknown>;
    if (updates.status) updateData.status = updates.status;

    const { error } = await (supabase as any)
      .from('pending_orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) {
      console.error('[PendingOrdersSync] Error updating pending order:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[PendingOrdersSync] Exception updating pending order:', err);
    return false;
  }
}

/**
 * Suscribirse a cambios en pedidos pendientes (Realtime)
 */
export function subscribeToPendingOrders(
  sellerId: string,
  onChange: (payload: { eventType: string; order: PendingOrderRecord }) => void,
) {
  const channel = supabase
    .channel('pending_orders_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pending_orders',
        filter: `seller_id=eq.${sellerId}`,
      },
      (payload: { eventType: string; new: Record<string, unknown> }) => {
        onChange({
          eventType: payload.eventType,
          order: mapSupabaseRecord(payload.new),
        });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================================
// Helpers
// ============================================================================

function mapSupabaseRecord(record: Record<string, unknown>): PendingOrderRecord {
  return {
    id: record.id as string,
    sellerId: record.seller_id as string,
    sellerName: record.seller_name as string | undefined,
    client: record.client_data as unknown as Client,
    items: record.items as unknown as CartItem[],
    details: (record.details || {}) as PendingOrderData['details'],
    status: record.status as 'pending' | 'syncing' | 'failed' | 'completed',
    attemptCount: (record.attempt_count as number) || 0,
    lastError: record.last_error as string | undefined,
    syncedOrderId: record.synced_order_id as string | undefined,
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
  };
}

async function updateOrderStatus(
  orderId: string,
  status: 'pending' | 'syncing' | 'failed' | 'completed',
): Promise<void> {
  const { error } = await (supabase as any)
    .from('pending_orders')
    .update({
      status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    console.error('[PendingOrdersSync] Error updating status:', error);
  }
}

async function markOrderCompleted(
  orderId: string,
  apiOrderId: string,
  apiResponse: { orderId?: string; message?: string },
): Promise<void> {
  const { error } = await (supabase as any)
    .from('pending_orders')
    .update({
      status: 'completed',
      synced_order_id: apiOrderId,
      api_response: apiResponse,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    console.error('[PendingOrdersSync] Error marking completed:', error);
  }
}

async function incrementAttempt(orderId: string, errorMessage: string): Promise<void> {
  // Fallback a update directo - primero obtener el conteo actual
  const response = await (supabase as any)
    .from('pending_orders')
    .select('attempt_count')
    .eq('id', orderId)
    .single();

  const currentRecord = response.data as { attempt_count: number } | null;
  const newCount = (currentRecord?.attempt_count || 0) + 1;

  await (supabase as any)
    .from('pending_orders')
    .update({
      attempt_count: newCount,
      status: newCount >= 5 ? 'failed' : 'pending',
      last_error: errorMessage,
      last_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);
}

function shouldRetry(order: PendingOrderRecord): boolean {
  const attempts = order.attemptCount || 0;

  // Si ya tiene 5 intentos, no reintentar automáticamente
  if (attempts >= 5) {
    return false;
  }

  // Calcular backoff exponencial: 1min, 2min, 4min, 8min, 16min
  const backoffMinutes = 2 ** attempts;
  const lastAttempt = order.lastError ? new Date(order.updatedAt) : null;

  if (!lastAttempt) {
    return true; // Nunca se intentó
  }

  const minutesSinceLastAttempt = (Date.now() - lastAttempt.getTime()) / (1000 * 60);
  return minutesSinceLastAttempt >= backoffMinutes;
}
