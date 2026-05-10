import { Capacitor } from '@capacitor/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  CustomerRequestValidator,
  EventCreateRequestValidator,
  LoginRequestValidator,
  OrderRequestValidator,
  OrderStatusUpdateValidator,
  ProductVerificationRequestValidator,
  validateData,
} from '../lib/apiValidators';
import type { ApiClient, ApiOrder, CartItem, Client, Order, Product, Seller, User } from '../types';
import { savePendingOrder } from './pendingOrdersSync';

const REAL_API_URL = 'https://api.tecnogafas.com.ar';
const PROXY_API_URL = '/api';

const BASE_URL = Capacitor.isNativePlatform() ? REAL_API_URL : PROXY_API_URL;
const FETCH_TIMEOUT = 30000; // 30 seconds

// Se eliminó la caché en memoria para unificarla con Dexie en AppContext/DataSync

interface ApiEvent {
  id?: number | string;
  ID?: number | string;
  event_id?: number | string;
  read?: boolean | number | string;
  status?: string;
  readed?: number;
  type?: string;
  content?: string;
  user_id?: number;
  from_id?: number;
  created_at?: string;
  [key: string]: unknown;
}

let cachedEvents: ApiEvent[] | null = null;
let cachedEventsTimestamp: number = 0;
const CACHE_EVENTS_TTL = 60 * 1000; // 1 minute
let hasEventsApiFailed = false;

interface FetchError extends Error {
  name: string;
  message: string;
}

const customFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit & { timeout?: number },
): Promise<Response> => {
  const { timeout = FETCH_TIMEOUT, ...fetchInit } = init || {};

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(input, {
      cache: 'no-store',
      signal: controller.signal,
      ...fetchInit,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`⚠️ API call to ${input} returned status ${res.status}`);
      if (res.status >= 500) {
        window.dispatchEvent(
          new CustomEvent('api-error', {
            detail: { message: `Servidor devolvió error ${res.status}` },
          }),
        );
      }
    }
    return res;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const error = err as FetchError;
    if (error.name === 'AbortError') {
      console.error(`⏱️ Timeout for ${input}`);
      window.dispatchEvent(
        new CustomEvent('api-error', { detail: { message: 'Tiempo de espera agotado' } }),
      );
    } else {
      console.error(`❌ Fetch error for ${input}:`, error);
      window.dispatchEvent(
        new CustomEvent('api-error', {
          detail: { message: 'No se pudo conectar con la API (caída o sin red)' },
        }),
      );
    }
    throw error;
  }
};

export const apiService = {
  async getProducts(): Promise<Product[]> {
    const now = Date.now();

    const res = await customFetch(`${BASE_URL}/productos`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = (await res.json()) as {
      data?: Array<{
        product_id?: number;
        pid?: number;
        nombre_producto?: string;
        variaciones?: string;
        filtros?: string;
      }>;
    };
    const mappedProducts = (json.data || []).map((p) => {
      // Parse variations usando parsing estructurado más robusto
      const variations = (p.variaciones || '')
        .split(';')
        .filter((v: string) => v.trim() !== '')
        .map((v: string) => {
          const variation: { vid: string; title: string; stock: number; price: number } = {
            vid: '',
            title: '',
            stock: 0,
            price: 0,
          };

          // Parse each field using structured approach
          const fields = v.split('|');
          for (const field of fields) {
            const [key, ...valueParts] = field.split(':');
            const value = valueParts.join(':').trim();

            if (!key) continue;
            switch (key.toLowerCase()) {
              case 'variation_id':
                variation.vid = value;
                break;
              case 'título':
              case 'titulo':
                variation.title = value;
                break;
              case 'stock':
                variation.stock = parseInt(value) || 0;
                break;
              case 'precio':
                variation.price = parseFloat(value) || 0;
                break;
            }
          }

          return variation;
        });

      const filtros = p.filtros || '';
      const category = filtros.includes('Post:')
        ? 'Otros'
        : (filtros.split('|')[0] || 'General').replace('Termino:', '');

      const pId = p.product_id || p.pid;
      return {
        id: pId?.toString() || Math.random().toString(),
        name: p.nombre_producto || '',
        category,
        price: variations[0]?.price || 0,
        stock: variations.reduce((acc, v) => acc + v.stock, 0),
        description: filtros,
        variations,
      };
    });
    return mappedProducts;
  },

  async getClients(): Promise<Client[]> {
    const res = await customFetch(`${BASE_URL}/clientes`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = (await res.json()) as { data?: ApiClient[] };
    return (json.data || []).map((c) => ({
      id: c.ID?.toString() || Math.random().toString(),
      name: c.display_name || '',
      email: c.user_email || '',
      phone: c.billing_phone || '',
      address: c.billing_address_1 || '',
      billing_city: c.billing_city || '',
      billing_state: c.billing_state || '',
      cuit: c.info_fiscal || '',
    }));
  },

  async getStats(): Promise<{
    success: boolean;
    data: {
      total_clientes: number;
      total_usuarios: number;
      total_productos: number;
      total_pedidos: number;
      pedidos_ultimas_24h: number;
      items_ultimas_24h: number;
      pedidos_mes_actual: number;
      items_mes_actual: number;
      productos_mas_pedidos_24h: Array<{
        product_id: number;
        variation_id: number;
        name: string;
        total_quantity: number;
        order_count: number;
      }>;
      productos_mas_pedidos_mes: Array<{
        product_id: number;
        variation_id: number;
        name: string;
        total_quantity: number;
        order_count: number;
      }>;
    };
    message?: string;
  }> {
    const url = `${BASE_URL}/stats`;

    const res = await customFetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const json = (await res.json()) as {
      success?: boolean;
      data?: {
        total_clientes: number;
        total_usuarios: number;
        total_productos: number;
        total_pedidos: number;
        pedidos_ultimas_24h: number;
        items_ultimas_24h: number;
        pedidos_mes_actual: number;
        items_mes_actual: number;
        productos_mas_pedidos_24h: Array<{
          product_id: number;
          variation_id: number;
          name: string;
          total_quantity: number;
          order_count: number;
        }>;
        productos_mas_pedidos_mes: Array<{
          product_id: number;
          variation_id: number;
          name: string;
          total_quantity: number;
          order_count: number;
        }>;
      };
      message?: string;
    };

    if (!json.success) {
      throw new Error(json.message || 'Error al obtener estadísticas');
    }

    return {
      success: json.success,
      data: json.data || {
        total_clientes: 0,
        total_usuarios: 0,
        total_productos: 0,
        total_pedidos: 0,
        pedidos_ultimas_24h: 0,
        items_ultimas_24h: 0,
        pedidos_mes_actual: 0,
        items_mes_actual: 0,
        productos_mas_pedidos_24h: [],
        productos_mas_pedidos_mes: [],
      },
      message: json.message,
    };
  },

  async getOrders(
    page: number = 1,
    perPage: number = 25,
    sellerId?: number | string,
    customerId?: number | string,
  ): Promise<{ orders: Order[]; total: number }> {
    let url = `${BASE_URL}/pedidos?page=${page}&per_page=${perPage}`;
    if (sellerId) url += `&seller_id=${sellerId}`;
    if (customerId) url += `&customer_id=${customerId}`;

    const headers: Record<string, string> = {};
    if (sellerId) headers.Authorization = `Bearer ${sellerId}`;

    const res = await customFetch(url, { headers });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = (await res.json()) as { data?: ApiOrder[]; total?: number };
    const orders = (json.data || []).map((o) => {
      let clientName = 'Sin cliente';
      if (o.customer) {
        if (o.customer.display_name) {
          clientName = o.customer.display_name;
        } else if (o.customer.first_name || o.customer.last_name) {
          clientName = `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim();
        }
      } else if (o.post_title) {
        // Fallback para cuando el endpoint es público y no devuelve el objeto customer
        clientName = o.post_title;
      }

      return {
        id: o.ID?.toString() || Math.random().toString(),
        clientId: o.customer_id?.toString() || '',
        clientName,
        items: (o.items || []).map((i) => ({
          productId: i.product_id?.toString() || '',
          productName: i.name || '',
          quantity: i.quantity || 0,
          price: i.price || 0,
          vid: i.vid?.toString(),
        })),
        total: o.order_total ? parseFloat(o.order_total.toString()) : 0,
        status: (o.post_status === 'unattended' ? 'unattended' : 'attended') as Order['status'],
        createdAt: o.post_date || '',
        sellerId: o.post_author?.toString() || '',
        sellerName: o.seller_name,
        rawData: {
          ...o,
          customer_note:
            o.observaciones || o.customer_note || (o as ApiOrder & { notes?: string }).notes || '',
        },
      };
    });
    return { orders, total: json.total || orders.length };
  },

  async getRecentOrders(sellerId?: number | string): Promise<Order[]> {
    let url = `${BASE_URL}/pedidos?page=1&per_page=5`;
    if (sellerId) url += `&seller_id=${sellerId}`;

    const headers: Record<string, string> = {};
    if (sellerId) headers.Authorization = `Bearer ${sellerId}`;

    const res = await customFetch(url, { headers });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = (await res.json()) as { data?: ApiOrder[] };
    
    const orders = (json.data || []).map((o) => {
      let clientName = 'Sin cliente';
      if (o.customer) {
        if (o.customer.display_name) {
          clientName = o.customer.display_name;
        } else if (o.customer.first_name || o.customer.last_name) {
          clientName = `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim();
        }
      } else if (o.post_title) {
        // Fallback para cuando el endpoint es público y no devuelve el objeto customer
        clientName = o.post_title;
      }

      return {
        id: o.ID?.toString() || Math.random().toString(),
        clientId: o.customer_id?.toString() || '',
        clientName,
        items: (o.items || []).map((i) => ({
          productId: i.product_id?.toString() || '',
          productName: i.name || '',
          quantity: i.quantity || 0,
          price: i.price || 0,
          vid: i.vid?.toString(),
        })),
        total: o.order_total ? parseFloat(o.order_total.toString()) : 0,
        status: (o.post_status === 'unattended' ? 'unattended' : 'attended') as Order['status'],
        createdAt: o.post_date || '',
        sellerId: o.post_author?.toString() || '',
        sellerName: o.seller_name,
        rawData: {
          ...o,
          customer_note:
            o.observaciones || o.customer_note || (o as ApiOrder & { notes?: string }).notes || '',
        },
      };
    });

    // Ordenar por ID descendente para asegurar los más recientes primero
    return orders.sort((a, b) => {
      const idA = parseInt(a.id);
      const idB = parseInt(b.id);
      if (isNaN(idA) || isNaN(idB)) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return idB - idA;
    });
  },

  async verifyProducts(
    products: { product_id: number; variation_id?: number; price: number; stock: number }[],
    sellerId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    total?: number;
    verified?: number;
    failed?: number;
    results?: Array<{
      product_id: number;
      variation_id?: number;
      product_name?: string;
      variation_name?: string;
      status:
        | 'ok'
        | 'not_found'
        | 'out_of_stock'
        | 'insufficient_stock'
        | 'stock_changed'
        | 'both_changed';
      error?: string;
      current_stock?: number;
      current_price?: number;
    }>;
  }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (sellerId) {
        headers['Authorization'] = `Bearer ${sellerId}`;
      }
      const res = await customFetch(`${BASE_URL}/producto/verificar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ products }),
      });
      return await res.json();
    } catch (e) {
      console.error('Error verifying products', e);
      return { success: false, message: 'Error de conexión durante verificación' };
    }
  },

  async getAppVersion(): Promise<{
    version?: string;
    apk_url?: string;
    release_notes?: string;
  } | null> {
    try {
      const res = await customFetch(`${BASE_URL}/app/version`);
      if (res.ok) {
        return (await res.json()) as { version?: string; apk_url?: string; release_notes?: string };
      }
      return null;
    } catch (_e) {
      console.error('Error fetching app version', _e);
      return null;
    }
  },

  async getEvents(type?: string, sellerId?: string): Promise<ApiEvent[]> {
    if (hasEventsApiFailed) return [];

    if (!type && cachedEvents && Date.now() - cachedEventsTimestamp < CACHE_EVENTS_TTL) {
      console.log('📦 Using cached events');
      return cachedEvents;
    }

    const url = new URL(`${BASE_URL}/events/list`, window.location.origin);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (sellerId) {
      headers['Authorization'] = `Bearer ${sellerId}`;
    }

    const body: Record<string, string | number> = { limit: 100 };
    if (type) body.type = type;

    console.log('📡 Fetching events:', { url: url.toString(), hasSeller: !!sellerId, type });

    try {
      const res = await customFetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      console.log('📡 Events response status:', res.status);
      if (!res.ok) {
        console.warn('⚠️ Events API error:', res.status);
        if (res.status === 500) {
          hasEventsApiFailed = true;
        }
        return []; // Silent fail for events to avoid crashing UI
      }
      const json = await res.json();
      console.log('📡 Events response data:', json);
      const events = this.extractEvents(json);
      console.log('📡 Extracted events:', events.length);

      if (!type) {
        cachedEvents = events;
        cachedEventsTimestamp = Date.now();
      }

      return events;
    } catch (e) {
      console.error('❌ Error in getEvents:', e);
      return [];
    }
  },

  // Nuevo endpoint combinado: eventos + unread count en una sola llamada
  async syncEvents(
    sellerId: string,
    lastId?: number,
    type?: string,
  ): Promise<{ events: ApiEvent[]; unread: number; lastId: number } | null> {
    const url = new URL(`${BASE_URL}/events/sync`, window.location.origin);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${sellerId}`,
    };

    const body: Record<string, string | number> = { limit: 50 };
    if (lastId !== undefined) body.last_id = lastId;
    if (type) body.type = type;

    console.log('📡 Syncing events (combined):', { lastId, type });

    try {
      const res = await customFetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.warn('⚠️ Events sync error:', res.status);
        return null;
      }

      const json = await res.json();
      if (!json.success) return null;

      console.log('📡 Synced events:', {
        count: json.events?.length,
        unread: json.unread,
        lastId: json.last_id,
      });

      return {
        events: json.events || [],
        unread: json.unread || 0,
        lastId: json.last_id || lastId || 0,
      };
    } catch (e) {
      console.error('❌ Error in syncEvents:', e);
      return null;
    }
  },

  extractEvents(json: Record<string, unknown>): ApiEvent[] {
    // Robust extraction: handle { events: [] }, { data: [] }, { data: { events: [] } }, etc.
    let list: unknown = json.events || json.notifications || json.data || [];
    if (!Array.isArray(list) && list !== null && typeof list === 'object') {
      const objList = list as Record<string, unknown>;
      list = objList.events || objList.notifications || objList.data || [];
    }

    if (!Array.isArray(list)) return [];

    // Normalize events: ensure 'id' exists and 'read' is boolean
    return list.map((n: ApiEvent) => ({
      ...n,
      id: n.id || n.ID || n.event_id,
      read: n.read === 1 || n.read === true || n.status === 'read' || n.readed === 1,
    }));
  },

  async createEvent(
    data: {
      user_id: number;
      type: 'message' | 'notification' | string;
      from_id?: number;
      content: string | Record<string, unknown>;
      read?: number;
    },
    sellerId?: string,
  ): Promise<ApiEvent | { error: string }> {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(sellerId ? { Authorization: `Bearer ${sellerId}` } : {}),
    };

    const body = JSON.stringify(data);
    console.log('API_DEBUG: URL:', `${BASE_URL}/event`, 'Payload:', body);

    const res = await customFetch(`${BASE_URL}/event`, {
      method: 'POST',
      headers,
      body,
    });
    return res.json();
  },

  async getUnreadCount(sellerId?: string): Promise<number> {
    try {
      // BASE_URL puede ser '/api', por lo que new URL necesita un base absoluto
      const url = new URL(`${BASE_URL}/events/unread`, window.location.origin);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (sellerId) headers['Authorization'] = `Bearer ${sellerId}`;
      const res = await customFetch(url.toString(), { method: 'POST', headers });
      if (!res.ok) return 0;
      const json = await res.json();
      return json.unread || json.count || 0;
    } catch (_e) {
      console.warn('Silent fail for unread count', _e);
      return 0;
    }
  },

  async ackEvent(id: number, sellerId?: string): Promise<ApiEvent | { error: string }> {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(sellerId ? { Authorization: `Bearer ${sellerId}` } : {}),
    };
    const res = await customFetch(`${BASE_URL}/ack`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id }),
    });
    return res.json();
  },

  async createOrder(
    clientId: string,
    items: Array<{ id: string; vid?: string; price: number; quantity: number }>,
    details: {
      commit?: string;
      discount?: number | string;
      recargo?: number | string;
      transport?: string;
      methodpay?: string;
      otheremail?: string;
      iva?: number | string;
      sendEmail?: boolean;
    },
    sellerId: string,
    fullClient?: Client,
    orderTitle?: string, // Nuevo parámetro para el título del pedido
  ): Promise<{ success: boolean; message: string; orderId?: string; rawData?: unknown }> {
    // VALIDACIÓN CRÍTICA: No permitir crear pedidos sin autenticación de vendedor
    if (!sellerId || sellerId.trim() === '') {
      console.error('[API] ERROR: Intento de crear pedido sin sellerId');
      return {
        success: false,
        message: 'No se puede crear un pedido sin la autenticación del vendedor',
      };
    }

    // Validar formato de sellerId (debe ser un ID numérico válido)
    if (!/^\d+$/.test(sellerId) && sellerId !== 'default_seller') {
      console.error('[API] ERROR: sellerId inválido:', sellerId);
      return {
        success: false,
        message: 'ID de vendedor inválido',
      };
    }

    const url = `${BASE_URL}/pedido`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${sellerId}`,
    };
    const bodyObj = {
      title: orderTitle, // Título con formato estándar
      client_id: parseInt(clientId),
      notes: details.commit,
      discount: details.discount ? details.discount.toString() : '0',
      recargo: details.recargo ? details.recargo.toString() : '0',
      transport: details.transport || '',
      methodpay: details.methodpay || '',
      oemail: details.otheremail || '',
      iva: details.iva ? parseInt(String(details.iva)) : 0,
      send_email: details.sendEmail !== undefined ? details.sendEmail : true,
      products: items
        .map((i) => {
          const parsedId = parseInt(i.id.toString().split('-')[0] ?? '', 10);
          if (isNaN(parsedId)) return null;
          return {
            product_id: parsedId,
            variation_id: i.vid ? parseInt(i.vid) : undefined,
            quantity: i.quantity,
            price: i.price,
          };
        })
        .filter(
          (
            p,
          ): p is {
            product_id: number;
            variation_id: number | undefined;
            quantity: number;
            price: number;
          } => p !== null,
        ),
    };
    const body = JSON.stringify(bodyObj);

    const enqueuePendingOrder = async (reason: string) => {
      const clientData: Client = fullClient || {
        id: clientId,
        name: '',
        email: '',
        phone: '',
        address: '',
      };

      const pendingResult = await savePendingOrder(
        sellerId,
        clientData,
        items as CartItem[],
        {
          commit: details.commit,
          discount: details.discount,
          recargo: details.recargo,
          transport: details.transport,
          methodpay: details.methodpay,
          otheremail: details.otheremail,
          iva: details.iva,
          sendEmail: details.sendEmail,
        },
        localStorage.getItem('seller_name') || undefined,
      );

      if (!pendingResult.success) {
        return {
          success: false,
          message: pendingResult.error || 'Error al guardar pedido pendiente.',
        };
      }

      return {
        success: false,
        message: `${reason} El pedido quedó guardado localmente y se sincronizará automáticamente.`,
        orderId: pendingResult.orderId,
      };
    };

    if (!navigator.onLine) {
      return enqueuePendingOrder('Estás sin conexión.');
    }

    try {
      const res = await customFetch(url, {
        method: 'POST',
        headers,
        body,
      });

      let data: {
        message?: string;
        error?: string;
        order_id?: string | number;
        data?: { message?: string; order_id?: string | number };
      };
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      let msg = data?.message || data?.data?.message || data?.error;
      if (!msg && typeof data === 'string') msg = data;
      if (!msg) msg = res.ok ? 'Pedido creado con éxito' : 'Error al crear el pedido';

      // Si el pedido se creó exitosamente, enviar notificación al chat
      if (res.ok && (data?.order_id || data?.data?.order_id)) {
        try {
          const { createOrderNotification } = await import('./chatNotificationService');

          // Obtener información del vendedor
          const sellerInfo: Seller = {
            id: sellerId,
            name: localStorage.getItem('seller_name') || 'Vendedor',
          };

          // Crear objeto Order para la notificación
          const orderForNotification: Order = {
            id: (data?.order_id || data?.data?.order_id)?.toString() || 'unknown',
            clientId: clientId.toString(),
            clientName: fullClient?.name || 'Cliente',
            items: (items as CartItem[]).map((item) => ({
              productId: item.id.toString(),
              productName: item.name || 'Producto',
              quantity: item.quantity,
              price: item.price,
              vid: item.vid,
            })),
            total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
            status: 'unattended',
            createdAt: new Date().toISOString(),
            sellerId: sellerId,
            sellerName: sellerInfo.name,
            rawData: {} as ApiOrder,
          };

          // Enviar notificación asíncronamente (no bloquear la respuesta)
          createOrderNotification(orderForNotification, sellerInfo).catch((err) => {
            console.error('[API] Error al enviar notificación de pedido:', err);
          });

          // Actualizar estadísticas locales
          try {
            const { incrementOrderStats } = await import('./statsService');
            incrementOrderStats();
          } catch (statsError) {
            console.error('[API] Error al actualizar estadísticas:', statsError);
          }
        } catch (notificationError) {
          console.error(
            '[API] Error al inicializar servicio de notificaciones:',
            notificationError,
          );
        }
      }

      return {
        success: res.ok,
        message: msg,
        orderId: (data?.order_id || data?.data?.order_id)?.toString(),
        rawData: data,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error de conexión con el servidor.';
      return enqueuePendingOrder(msg);
    }
  },

  async saveClient(client: Partial<Client>): Promise<boolean> {
    const sellerId = localStorage.getItem('seller_id');
    const [firstName, ...lastNames] = (client.name || '').split(' ');
    const lastName = lastNames.join(' ');

    const url = `${BASE_URL}/cliente`;

    const res = await customFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email: client.email || '',
        first_name: firstName,
        last_name: lastName,
        billing_phone: client.phone || '',
        billing_address: client.address || '',
        billing_city: client.billing_city || '',
        billing_state: client.billing_state || '',
        info_fiscal: client.cuit || '',
      }),
    });
    return res.ok;
  },

  async getUsers(sellerId?: string): Promise<User[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (sellerId) {
      headers['Authorization'] = `Bearer ${sellerId}`;
    }

    const res = await customFetch(`${BASE_URL}/usuarios`, { headers });
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const json = (await res.json()) as {
      data?: Array<{
        ID?: number;
        user_login?: string;
        display_name?: string;
        user_email?: string;
        first_name?: string;
        last_name?: string;
      }>;
    };

    return (json.data || []).map((u) => ({
      id: u.ID?.toString() || Math.random().toString(),
      username: u.user_login || '',
      name: u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
      email: u.user_email || '',
      firstName: u.first_name || '',
      lastName: u.last_name || '',
    }));
  },

  async loginSeller(pin: string): Promise<Seller | null> {
    // Validar payload con Zod
    const payloadValidation = validateData(LoginRequestValidator, { data: pin });
    if (!payloadValidation.success) {
      console.error('Login payload validation failed:', payloadValidation.error);
      return null;
    }

    const res = await customFetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadValidation.data),
    });
    if (!res.ok) {
      console.error('Login failed', res.status, await res.text());
      return null;
    }
    const json = await res.json();
    return {
      id: json.user?.id?.toString() || 'default_seller',
      name: json.user?.name || 'Vendedor',
    };
  },

  async downloadOrderPdf(orderId: number | string, sellerId: string): Promise<Blob | false> {
    try {
      const res = await customFetch(`${BASE_URL}/pedido/${orderId}/pdf`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sellerId}` },
      });
      if (!res.ok) {
        // Handle 404 specifically for missing endpoints
        if (res.status === 404) {
          console.warn('PDF download endpoint not available for order:', orderId);
        }
        return false;
      }
      return await res.blob();
    } catch {
      return false;
    }
  },

  async regenerateOrder(
    orderId: string,
    sellerId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await customFetch(`${BASE_URL}/pedido/${orderId}/regenerar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sellerId}` },
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      return {
        success: res.ok && data.success !== false,
        message: data.message || (res.ok ? 'Pedido regenerado' : 'Error al regenerar pedido'),
      };
    } catch {
      return { success: false, message: 'Error de conexión' };
    }
  },

  async getLogs(
    context: string,
    sellerId: string,
  ): Promise<{ success: boolean; message: string; logs?: unknown[] }> {
    try {
      const res = await customFetch(`${BASE_URL}/logs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sellerId}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ context }),
      });
      return (await res.json()) as { success: boolean; message: string; logs?: unknown[] };
    } catch {
      console.error('Error fetching logs');
      return { success: false, message: 'Error de conexión' };
    }
  },

  async sendOrderEmail(
    orderId: string,
    sellerId: string,
  ): Promise<{ success: boolean; message: string; pdf_url?: string }> {
    try {
      // Try the primary endpoint first
      let res = await customFetch(`${BASE_URL}/pedido/${orderId}/enviar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sellerId}` },
      });

      // If primary endpoint fails with 404, try alternative endpoint
      if (res.status === 404) {
        console.log('Primary email endpoint not found, trying alternative...');
        res = await customFetch(`${BASE_URL}/pedido/${orderId}/email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sellerId}` },
        });
      }

      // If both endpoints fail with 404, return a helpful message
      if (res.status === 404) {
        return {
          success: false,
          message: 'La función de envío de emails no está disponible en este momento. El pedido ha sido procesado correctamente.',
        };
      }

      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text || 'Error desconocido' };
      }

      if (!res.ok) {
        return {
          success: false,
          message: data.message || `Error al enviar email (Status: ${res.status})`,
        };
      }

      let msg = data.message || 'Email enviado exitosamente';
      if (data.recipients && Array.isArray(data.recipients)) {
        msg += ` a: ${data.recipients.join(', ')}`;
      }

      return {
        success: true,
        message: msg,
        pdf_url: data.pdf_url,
      };
    } catch (error) {
      console.error('Error sending order email:', error);
      return {
        success: false,
        message: 'Error de conexión al enviar email. El pedido ha sido procesado correctamente.',
      };
    }
  },

  async updateOrderStatus(
    orderId: string,
    status: 'attended' | 'unattended',
    sellerId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await customFetch(`${BASE_URL}/pedido/${orderId}/estado`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${sellerId}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.message || 'Error al actualizar estado' };
      return { success: true, message: data.message || 'Estado actualizado' };
    } catch {
      return { success: false, message: 'Error de conexión' };
    }
  },

  subscribeToEvents(onMessage: (data: ApiEvent) => void) {
    const eventSource = new EventSource(`${BASE_URL}/events/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Lógica de orquestación centralizada
        if (data.type === 'order') {
          console.log('🔄 Evento de orden recibido, invalidando caché y refrescando pedidos...');
          // Disparamos evento para que la App refresque estados si es necesario
          window.dispatchEvent(new CustomEvent('refresh-orders'));
        }

        onMessage(data);
      } catch (_e) {
        console.error('Error parsing SSE data', _e);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error', err);
    };

    return () => eventSource.close();
  },

  // ============================================================================
  // SUPABASE HELPERS (BRIDGE)
  // ============================================================================

  async getSupabaseNotificationChannel(): Promise<{ data: { id: string } | null; error: unknown }> {
    const { supabase } = await import('../modules/chat/lib/supabase');
    const { data, error } = await supabase
      .from('conversations')
      .select('id')
      .eq('slug', 'notificaciones')
      .single();
    return { data, error };
  },

  async getSupabaseMemberStatus(
    conversationId: string,
    userId: string,
  ): Promise<{ data: { unread_count: number } | null; error: unknown }> {
    const { supabase } = await import('../modules/chat/lib/supabase');
    const { data, error } = await supabase
      .from('conversation_members')
      .select('unread_count')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();
    return { data, error };
  },

  async subscribeToSupabaseTable(
    table: string,
    filter: string,
    callback: (payload: Record<string, unknown>) => void,
  ) {
    const { channelManager } = await import('../modules/chat/lib/supabase');
    const channelName = `global-${table}`;

    // Clean up any existing subscription to avoid "after subscribe" errors
    await channelManager.unsubscribe(channelName);

    const channel = channelManager.getChannel(channelName);

    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, callback);
    await channelManager.subscribe(channelName);

    return channel;
  },

  async unsubscribeSupabase(channel: RealtimeChannel | null) {
    if (!channel) return;
    const { channelManager } = await import('../modules/chat/lib/supabase');
    await channelManager.removeChannel(channel);
  },

  // ============================================================================
  // SUPABASE AUTH BRIDGE
  // ============================================================================

  async syncSupabaseAuth(pin: string) {
    const { unifiedAuthService } = await import('./unifiedAuthService');
    return unifiedAuthService.authenticateWithPin(pin);
  },
};
