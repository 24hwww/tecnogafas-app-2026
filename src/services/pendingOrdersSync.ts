/**
 * Cola centralizada de pedidos pendientes.
 *
 * Dexie es la fuente de verdad para persistencia offline. Supabase se usa como
 * espejo best-effort en segundo plano para observabilidad y respaldo remoto.
 */

import { Capacitor } from '@capacitor/core';
import { supabase } from '../modules/chat/lib/supabase';
import type { PendingOrderRow } from '../modules/chat/types';
import { appDB, type LocalPendingOrder } from '../stores/appDatabase';
import type { ApiOrder, CartItem, Client, Order, Seller } from '../types';

const REAL_API_URL = 'https://api.tecnogafas.com.ar';
const PROXY_API_URL = '/api';
const BASE_URL = Capacitor.isNativePlatform() ? REAL_API_URL : PROXY_API_URL;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const MAX_ATTEMPTS = 5;
const activeSyncIds = new Set<string>();
let isSyncAllRunning = false;

export interface PendingOrderData {
  id?: string;
  sellerId: string;
  sellerName?: string;
  client: Client;
  items: CartItem[];
  details: LocalPendingOrder['details'];
  status?: LocalPendingOrder['status'];
  attemptCount?: number;
  lastError?: string;
  createdAt?: string;
  syncedOrderId?: string;
  supabaseId?: string;
}

export interface PendingOrderRecord extends LocalPendingOrder {}

interface OrderApiResponse {
  success?: boolean;
  message?: string;
  orderId?: string | number;
  order_id?: string | number;
  data?: {
    order_id?: string | number;
    message?: string;
  };
  error?: string;
}

export async function savePendingOrder(
  sellerId: string,
  client: Client,
  items: CartItem[],
  details: PendingOrderData['details'],
  sellerName?: string,
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const now = new Date().toISOString();
    const id = createLocalPendingOrderId(sellerId, client.id);
    const existing = await findRecentEquivalentOrder(sellerId, client.id, items, details);

    if (existing) {
      mirrorPendingOrderToSupabase(existing).catch((err) => {
        console.warn('[PendingOrdersSync] Supabase mirror failed:', err);
      });
      return { success: true, orderId: existing.id };
    }

    const record: LocalPendingOrder = {
      id,
      sellerId,
      sellerName,
      client,
      items,
      details,
      status: 'pending',
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await appDB.pendingOrders.put(record);

    mirrorPendingOrderToSupabase(record).catch((err) => {
      console.warn('[PendingOrdersSync] Supabase mirror failed:', err);
    });

    return { success: true, orderId: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[PendingOrdersSync] Exception saving pending order:', message);
    return { success: false, error: message };
  }
}

export async function getPendingOrders(
  sellerId: string,
  status?: Array<'pending' | 'syncing' | 'failed'>,
): Promise<PendingOrderRecord[]> {
  const allowedStatuses = status ?? ['pending', 'failed'];
  const orders = await appDB.pendingOrders
    .where('sellerId')
    .equals(sellerId)
    .filter((order) => allowedStatuses.includes(order.status as 'pending' | 'syncing' | 'failed'))
    .reverse()
    .sortBy('createdAt');

  return orders.reverse();
}

export async function syncPendingOrder(
  order: PendingOrderRecord,
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  if (activeSyncIds.has(order.id)) {
    return { success: false, error: 'Pedido ya está sincronizándose' };
  }

  if (!shouldRetry(order)) {
    return { success: false, error: 'Esperando ventana de reintento' };
  }

  activeSyncIds.add(order.id);

  try {
    await updateOrderStatus(order.id, 'syncing');

    const response = await postOrderToApi(order);
    const apiOrderId = getApiOrderId(response);

    if (apiOrderId) {
      await markOrderCompleted(order.id, apiOrderId, response);
      await runPostSyncSideEffects(order, apiOrderId);
      return { success: true, orderId: apiOrderId };
    }

    const errorMessage = response.message || response.error || 'API no devolvió ID de pedido';
    await incrementAttempt(order.id, errorMessage);
    return { success: false, error: errorMessage };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during sync';
    await incrementAttempt(order.id, message);
    return { success: false, error: message };
  } finally {
    activeSyncIds.delete(order.id);
  }
}

export async function syncAllPendingOrders(
  sellerId: string,
  onProgress?: (current: number, total: number, orderId: string) => void,
): Promise<{ success: number; failed: number; total: number }> {
  if (isSyncAllRunning) {
    return { success: 0, failed: 0, total: 0 };
  }

  isSyncAllRunning = true;

  try {
    const orders = await getPendingOrders(sellerId, ['pending', 'failed']);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < orders.length; i += 1) {
      const order = orders[i];
      if (!order) continue;

      onProgress?.(i + 1, orders.length, order.id);

      const result = await syncPendingOrder(order);
      if (result.success) {
        success += 1;
      } else if (result.error !== 'Esperando ventana de reintento') {
        failed += 1;
      }

      if (i < orders.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return { success, failed, total: orders.length };
  } finally {
    isSyncAllRunning = false;
  }
}

export async function deletePendingOrder(orderId: string, sellerId: string): Promise<boolean> {
  const order = await appDB.pendingOrders.get(orderId);
  if (!order || order.sellerId !== sellerId) return false;

  await appDB.pendingOrders.delete(orderId);

  if (order.supabaseId && navigator.onLine) {
    deleteSupabasePendingOrder(order.supabaseId, sellerId).catch((err) => {
      console.warn('[PendingOrdersSync] Supabase delete failed:', err);
    });
  }

  return true;
}

export async function updatePendingOrder(
  orderId: string,
  updates: Partial<PendingOrderData>,
): Promise<boolean> {
  const order = await appDB.pendingOrders.get(orderId);
  if (!order) return false;

  const updated: LocalPendingOrder = {
    ...order,
    sellerName: updates.sellerName ?? order.sellerName,
    client: updates.client ?? order.client,
    items: updates.items ?? order.items,
    details: updates.details ?? order.details,
    status: updates.status ?? order.status,
    attemptCount: updates.attemptCount ?? order.attemptCount,
    lastError: updates.lastError ?? order.lastError,
    syncedOrderId: updates.syncedOrderId ?? order.syncedOrderId,
    supabaseId: updates.supabaseId ?? order.supabaseId,
    updatedAt: new Date().toISOString(),
  };

  await appDB.pendingOrders.put(updated);
  mirrorPendingOrderToSupabase(updated).catch((err) => {
    console.warn('[PendingOrdersSync] Supabase mirror failed:', err);
  });

  return true;
}

export function subscribeToPendingOrders(
  sellerId: string,
  onChange: (payload: { eventType: string; order: PendingOrderRecord }) => void,
) {
  let cancelled = false;

  const notify = async () => {
    const orders = await getPendingOrders(sellerId, ['pending', 'failed']);
    if (!cancelled) {
      for (const order of orders) {
        onChange({ eventType: 'LOCAL', order });
      }
    }
  };

  notify();

  return () => {
    cancelled = true;
  };
}

async function postOrderToApi(order: PendingOrderRecord): Promise<OrderApiResponse> {
  const response = await fetch(`${BASE_URL}/pedido`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${order.sellerId}`,
    },
    body: JSON.stringify(buildOrderRequest(order)),
  });

  const payload = await safeJson<OrderApiResponse>(response);
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `API error: ${response.status}`);
  }

  return payload;
}

function buildOrderRequest(order: PendingOrderRecord) {
  return {
    client_id: parseInt(order.client.id, 10),
    notes: order.details.commit,
    discount: order.details.discount ? order.details.discount.toString() : '0',
    recargo: order.details.recargo ? order.details.recargo.toString() : '0',
    transport: order.details.transport || '',
    methodpay: order.details.methodpay || '',
    oemail: order.details.otheremail || '',
    iva: order.details.iva ? parseInt(String(order.details.iva), 10) : 0,
    send_email: order.details.sendEmail ?? true,
    products: order.items
      .map((item) => {
        const productId = parseInt(item.id.toString().split('-')[0] ?? '', 10);
        if (Number.isNaN(productId)) return null;
        return {
          product_id: productId,
          variation_id: item.vid ? parseInt(item.vid, 10) : undefined,
          quantity: item.quantity,
          price: item.price,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
  };
}

async function runPostSyncSideEffects(order: PendingOrderRecord, orderId: string): Promise<void> {
  const seller: Seller = {
    id: order.sellerId,
    name: order.sellerName || localStorage.getItem('seller_name') || 'Vendedor',
  };

  if (order.details.sendEmail ?? true) {
    sendOrderEmail(orderId, order.sellerId).catch((err) => {
      console.warn('[PendingOrdersSync] Email after sync failed:', err);
    });
  }

  try {
    const { createOrderNotification } = await import('./chatNotificationService');
    await createOrderNotification(toOrder(order, orderId), seller);
  } catch (err) {
    console.warn('[PendingOrdersSync] Chat notification after sync failed:', err);
  }

  try {
    const { incrementOrderStats } = await import('./statsService');
    incrementOrderStats();
  } catch (err) {
    console.warn('[PendingOrdersSync] Stats update after sync failed:', err);
  }
}

async function sendOrderEmail(orderId: string, sellerId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/pedido/${orderId}/enviar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sellerId}` },
  });

  if (!response.ok) {
    throw new Error(`Email endpoint error: ${response.status}`);
  }
}

function toOrder(order: PendingOrderRecord, orderId: string): Order {
  return {
    id: orderId,
    clientId: order.client.id,
    clientName: order.client.name || 'Cliente',
    items: order.items.map((item) => ({
      productId: item.id.toString(),
      productName: item.name || 'Producto',
      quantity: item.quantity,
      price: item.price,
      vid: item.vid,
    })),
    total: order.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    status: 'unattended',
    createdAt: new Date().toISOString(),
    sellerId: order.sellerId,
    sellerName: order.sellerName,
    rawData: {} as ApiOrder,
  };
}

async function updateOrderStatus(
  orderId: string,
  status: LocalPendingOrder['status'],
): Promise<void> {
  await appDB.pendingOrders.update(orderId, {
    status,
    updatedAt: new Date().toISOString(),
  });

  const order = await appDB.pendingOrders.get(orderId);
  if (order) {
    mirrorPendingOrderToSupabase(order).catch((err) => {
      console.warn('[PendingOrdersSync] Supabase status mirror failed:', err);
    });
  }
}

async function markOrderCompleted(
  orderId: string,
  apiOrderId: string,
  apiResponse: OrderApiResponse,
): Promise<void> {
  await appDB.pendingOrders.update(orderId, {
    status: 'completed',
    syncedOrderId: apiOrderId,
    lastError: undefined,
    updatedAt: new Date().toISOString(),
  });

  const order = await appDB.pendingOrders.get(orderId);
  if (order) {
    mirrorPendingOrderToSupabase(order, apiResponse).catch((err) => {
      console.warn('[PendingOrdersSync] Supabase completed mirror failed:', err);
    });
  }
}

async function incrementAttempt(orderId: string, errorMessage: string): Promise<void> {
  const order = await appDB.pendingOrders.get(orderId);
  if (!order) return;

  const attemptCount = order.attemptCount + 1;
  const updated: LocalPendingOrder = {
    ...order,
    attemptCount,
    status: attemptCount >= MAX_ATTEMPTS ? 'failed' : 'pending',
    lastError: errorMessage,
    lastAttemptAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await appDB.pendingOrders.put(updated);
  mirrorPendingOrderToSupabase(updated).catch((err) => {
    console.warn('[PendingOrdersSync] Supabase attempt mirror failed:', err);
  });
}

async function mirrorPendingOrderToSupabase(
  order: PendingOrderRecord,
  apiResponse?: OrderApiResponse,
): Promise<void> {
  if (!navigator.onLine) return;

  const payload = toSupabasePayload(order, apiResponse);

  if (order.supabaseId) {
    await updateSupabasePendingOrder(order.supabaseId, payload);
    return;
  }

  const data = await insertSupabasePendingOrder(payload);

  await appDB.pendingOrders.update(order.id, {
    supabaseId: data.id,
    updatedAt: new Date().toISOString(),
  });
}

async function getSupabaseRestHeaders(): Promise<Record<string, string> | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token || SUPABASE_ANON_KEY;

  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

async function insertSupabasePendingOrder(
  payload: Omit<PendingOrderRow, 'id' | 'created_at' | 'updated_at'>,
): Promise<{ id: string }> {
  const headers = await getSupabaseRestHeaders();
  if (!headers || !SUPABASE_URL) throw new Error('Supabase REST is not configured');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/pending_orders?select=id`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Supabase insert failed: ${response.status}`);
  const rows = (await response.json()) as Array<{ id: string }>;
  const row = rows[0];
  if (!row) throw new Error('Supabase insert returned no row');
  return row;
}

async function updateSupabasePendingOrder(
  supabaseId: string,
  payload: Omit<PendingOrderRow, 'id' | 'created_at' | 'updated_at'>,
): Promise<void> {
  const headers = await getSupabaseRestHeaders();
  if (!headers || !SUPABASE_URL) return;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/pending_orders?id=eq.${encodeURIComponent(supabaseId)}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) throw new Error(`Supabase update failed: ${response.status}`);
}

async function deleteSupabasePendingOrder(supabaseId: string, sellerId: string): Promise<void> {
  const headers = await getSupabaseRestHeaders();
  if (!headers || !SUPABASE_URL) return;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/pending_orders?id=eq.${encodeURIComponent(
      supabaseId,
    )}&seller_id=eq.${encodeURIComponent(sellerId)}`,
    {
      method: 'DELETE',
      headers,
    },
  );

  if (!response.ok) throw new Error(`Supabase delete failed: ${response.status}`);
}

function toSupabasePayload(
  order: PendingOrderRecord,
  apiResponse?: OrderApiResponse,
): Omit<PendingOrderRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    seller_id: order.sellerId,
    seller_name: order.sellerName ?? null,
    client_id: order.client.id,
    client_data: { ...order.client },
    items: order.items.map((item) => ({ ...item })),
    details: { ...order.details },
    status: order.status,
    attempt_count: order.attemptCount,
    last_error: order.lastError ?? null,
    last_attempt_at: order.lastAttemptAt ?? null,
    api_response: apiResponse ? { ...apiResponse } : null,
    synced_order_id: order.syncedOrderId ?? null,
  };
}

function shouldRetry(order: PendingOrderRecord): boolean {
  if (order.attemptCount >= MAX_ATTEMPTS) return false;
  if (!order.lastAttemptAt) return true;

  const backoffMinutes = 2 ** order.attemptCount;
  const minutesSinceLastAttempt =
    (Date.now() - new Date(order.lastAttemptAt).getTime()) / (1000 * 60);

  return minutesSinceLastAttempt >= backoffMinutes;
}

function getApiOrderId(response: OrderApiResponse): string | undefined {
  const id = response.orderId ?? response.order_id ?? response.data?.order_id;
  return id === undefined || id === null ? undefined : id.toString();
}

async function safeJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

function createLocalPendingOrderId(sellerId: string, clientId: string): string {
  return `pending-${sellerId}-${clientId}-${Date.now()}-${crypto.randomUUID()}`;
}

async function findRecentEquivalentOrder(
  sellerId: string,
  clientId: string,
  items: CartItem[],
  details: PendingOrderData['details'],
): Promise<PendingOrderRecord | undefined> {
  const fiveSecondsAgo = Date.now() - 5000;
  const signature = JSON.stringify({ items, details });

  const recentOrders = await appDB.pendingOrders
    .where('sellerId')
    .equals(sellerId)
    .filter((order) => {
      if (order.client.id !== clientId) return false;
      if (order.status !== 'pending' && order.status !== 'failed') return false;
      if (new Date(order.createdAt).getTime() < fiveSecondsAgo) return false;
      return JSON.stringify({ items: order.items, details: order.details }) === signature;
    })
    .toArray();

  return recentOrders[0];
}
