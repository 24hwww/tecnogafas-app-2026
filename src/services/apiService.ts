import { ApiClient, ApiOrder, Product, Client, Order, Seller, CartItem } from '../types';
import { savePendingOrder } from './pendingOrdersSync';

import { Capacitor } from '@capacitor/core';

const REAL_API_URL = 'https://api.tecnogafas.com.ar';
const PROXY_API_URL = '/api';

const BASE_URL = Capacitor.isNativePlatform() ? REAL_API_URL : PROXY_API_URL;
const FETCH_TIMEOUT = 30000; // 30 seconds

let cachedProducts: Product[] | null = null;
let cachedProductsTimestamp: number = 0;
const CACHE_PRODUCTS_TTL = 5 * 60 * 1000; // 5 minutes

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

const customFetch = async (input: RequestInfo | URL, init?: RequestInit & { timeout?: number }): Promise<Response> => {
  const { timeout = FETCH_TIMEOUT, ...fetchInit } = init || {};
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const res = await fetch(input, {
      cache: 'no-store',
      signal: controller.signal,
      ...fetchInit
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`⚠️ API call to ${input} returned status ${res.status}`);
      if (res.status >= 500) {
        window.dispatchEvent(new CustomEvent('api-error', { detail: { message: `Servidor devolvió error ${res.status}` } }));
      }
    }
    return res;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const error = err as FetchError;
    if (error.name === 'AbortError') {
      console.error(`⏱️ Timeout for ${input}`);
      window.dispatchEvent(new CustomEvent('api-error', { detail: { message: 'Tiempo de espera agotado' } }));
    } else {
      console.error(`❌ Fetch error for ${input}:`, error);
      window.dispatchEvent(new CustomEvent('api-error', { detail: { message: 'No se pudo conectar con la API (caída o sin red)' } }));
    }
    throw error;
  }
};

export const apiService = {
  async getProducts(): Promise<Product[]> {
    const now = Date.now();
    if (cachedProducts && (now - cachedProductsTimestamp < CACHE_PRODUCTS_TTL)) {
      return cachedProducts;
    }

    const res = await customFetch(`${BASE_URL}/productos`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = await res.json() as { data?: Array<{
      product_id?: number;
      pid?: number;
      nombre_producto?: string;
      variaciones?: string;
      filtros?: string;
    }> };
    cachedProducts = (json.data || []).map((p) => {
      // Parse variations e.g. "variation_id:23726|Título:5508 - C1 - BLACK|Stock:6|Precio:58000;..."
      const variations = (p.variaciones || '').split(';').filter((v: string) => v.trim() !== '').map((v: string) => {
        let vid = '';
        let title = '';
        let stock = 0;
        let price = 0;

        const vidMatch = v.match(/variation_id:(\d+)/);
        if (vidMatch) vid = vidMatch[1];

        const stockMatch = v.match(/Stock:(-?\d+)/);
        if (stockMatch) stock = parseInt(stockMatch[1]);

        const priceMatch = v.match(/Precio:([\d.]+)/);
        if (priceMatch) price = parseFloat(priceMatch[1]);

        const titleMatch = v.match(/T[ií]tulo:(.*?)(?:\|Stock:|\|Precio:|$)/);
        if (titleMatch) {
          title = titleMatch[1];
        } else {
          // Fallback if the regex somehow misses
          const parts = v.split('|');
          const titlePart = parts.find(p => p.startsWith('Título:') || p.startsWith('Titulo:'));
          if (titlePart) title = titlePart.split(':')[1] || '';
        }

        return { vid, title, stock, price };
      });

      const filtros = p.filtros || '';
      const category = filtros.includes('Post:') ? 'Otros' : (filtros.split('|')[0] || 'General').replace('Termino:', '');
      
      const pId = p.product_id || p.pid;
      return {
        id: pId?.toString() || Math.random().toString(),
        name: p.nombre_producto || '',
        category,
        price: variations[0]?.price || 0,
        stock: variations.reduce((acc, v) => acc + v.stock, 0),
        description: filtros,
        variations
      };
    });
    cachedProductsTimestamp = now;
    return cachedProducts;
  },

  async getClients(): Promise<Client[]> {
    const res = await customFetch(`${BASE_URL}/clientes`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = await res.json() as { data?: ApiClient[] };
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
      total_orders: number;
      total_clients: number;
      total_products: number;
      total_sellers: number;
      recent_orders: number;
      pending_orders: number;
    };
    message?: string;
  }> {
    const url = `${BASE_URL}/stats`;
    
    const res = await customFetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    
    const json = await res.json() as { 
      success?: boolean; 
      data?: {
        total_orders: number;
        total_clients: number;
        total_products: number;
        total_sellers: number;
        recent_orders: number;
        pending_orders: number;
      }; 
      message?: string;
    };
    
    if (!json.success) {
      throw new Error(json.message || 'Error al obtener estadísticas');
    }
    
    return {
      success: json.success,
      data: json.data!,
      message: json.message
    };
  }

  async getOrders(page: number = 1, perPage: number = 25, sellerId?: number | string, customerId?: number | string): Promise<{ orders: Order[], total: number }> {
    let url = `${BASE_URL}/pedidos?page=${page}&per_page=${perPage}`;
    if (sellerId) url += `&seller_id=${sellerId}`;
    if (customerId) url += `&customer_id=${customerId}`;
    
    const headers = sellerId ? { 'Authorization': `Bearer ${sellerId}` } : {};
    
    const res = await customFetch(url, { headers });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = await res.json() as { data?: ApiOrder[]; total?: number };
    const orders = (json.data || []).map((o) => ({
      id: o.ID?.toString() || Math.random().toString(),
      clientId: o.customer_id?.toString() || '',
      clientName: o.customer ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() : 'Sin cliente',
      items: (o.items || []).map(i => ({
        productId: i.product_id?.toString() || '',
        productName: i.name || '',
        quantity: i.quantity || 0,
        price: i.price || 0,
        vid: i.vid?.toString(),
      })),
      total: o.order_total ? parseFloat(o.order_total.toString()) : 0,
      status: (o.post_status === 'unattended' ? 'Pendiente' : 'Completado') as Order['status'],
      createdAt: o.post_date || '',
      sellerId: o.post_author?.toString() || '',
      rawData: {
        ...o,
        customer_note: o.observaciones || o.customer_note || (o as ApiOrder & { notes?: string }).notes || '',
      },
    }));
    return { orders, total: json.total || orders.length };
  },

  async verifyProducts(products: {product_id: number, variation_id?: number, price: number, stock: number}[]): Promise<{
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
      status: 'ok' | 'not_found' | 'out_of_stock' | 'insufficient_stock' | 'stock_changed' | 'both_changed';
      error?: string;
      current_stock?: number;
      current_price?: number;
    }>;
  }> {
    try {
      const res = await customFetch(`${BASE_URL}/producto/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ products })
      });
      return await res.json();
    } catch(e) {
      console.error('Error verifying products', e);
      return { success: false, message: 'Error de conexión durante verificación' };
    }
  },

  async getSellers(): Promise<Seller[]> {
    const res = await customFetch(`${BASE_URL}/usuarios`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = await res.json() as { data?: Array<{ ID?: number; display_name?: string }> };
    return (json.data || []).map((s) => ({
      id: s.ID?.toString() || Math.random().toString(),
      name: s.display_name || 'Sin nombre',
    }));
  },

  async getAppVersion(): Promise<{ version?: string; apk_url?: string; release_notes?: string } | null> {
    try {
      const res = await customFetch(`${BASE_URL}/app/version`);
      if (res.ok) {
        return await res.json() as { version?: string; apk_url?: string; release_notes?: string };
      }
      return null;
    } catch (_e) {
      console.error('Error fetching app version', _e);
      return null;
    }
  },

  async getEvents(type?: string, sellerId?: string): Promise<ApiEvent[]> {
    if (hasEventsApiFailed) return [];
    
    if (!type && cachedEvents && (Date.now() - cachedEventsTimestamp < CACHE_EVENTS_TTL)) {
      console.log('📦 Using cached events');
      return cachedEvents;
    }

    const url = new URL(`${BASE_URL}/events/list`, window.location.origin);
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
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
        body: JSON.stringify(body)
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
  async syncEvents(sellerId: string, lastId?: number, type?: string): Promise<{ events: ApiEvent[]; unread: number; lastId: number } | null> {
    const url = new URL(`${BASE_URL}/events/sync`, window.location.origin);
    
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json', 
      'Accept': 'application/json',
      'Authorization': `Bearer ${sellerId}`
    };
    
    const body: Record<string, string | number> = { limit: 50 };
    if (lastId !== undefined) body.last_id = lastId;
    if (type) body.type = type;

    console.log('📡 Syncing events (combined):', { lastId, type });

    try {
      const res = await customFetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        console.warn('⚠️ Events sync error:', res.status);
        return null;
      }
      
      const json = await res.json();
      if (!json.success) return null;
      
      console.log('📡 Synced events:', { count: json.events?.length, unread: json.unread, lastId: json.last_id });
      
      return {
        events: json.events || [],
        unread: json.unread || 0,
        lastId: json.last_id || lastId || 0
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
      read: n.read === 1 || n.read === true || n.status === 'read' || n.readed === 1
    }));
  },

  async createEvent(data: { user_id: number; type: 'message' | 'notification' | string; from_id?: number; content: string | Record<string, unknown>; read?: number }, sellerId?: string): Promise<ApiEvent | { error: string }> {
    const headers = { 
      'Content-Type': 'application/json', 'Accept': 'application/json',
      ...(sellerId ? { 'Authorization': `Bearer ${sellerId}` } : {})
    };
    
    const body = JSON.stringify(data);
    console.log('API_DEBUG: URL:', `${BASE_URL}/event`, 'Payload:', body);

    const res = await customFetch(`${BASE_URL}/event`, {
      method: 'POST',
      headers,
      body
    });
    return res.json();
  },

  async getUnreadCount(sellerId?: string): Promise<number> {
    try {
      // BASE_URL puede ser '/api', por lo que new URL necesita un base absoluto
      const url = new URL(`${BASE_URL}/events/unread`, window.location.origin);
      if (sellerId) url.searchParams.set('pin', sellerId);

      
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
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
      'Content-Type': 'application/json', 'Accept': 'application/json',
      ...(sellerId ? { 'Authorization': `Bearer ${sellerId}` } : {})
    };
    const res = await customFetch(`${BASE_URL}/ack`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id })
    });
    return res.json();
  },

  async createOrder(clientId: string, items: Array<{ id: string; vid?: string; price: number; quantity: number }>, details: {
    commit?: string;
    discount?: number | string;
    recargo?: number | string;
    transport?: string;
    methodpay?: string;
    otheremail?: string;
    iva?: number | string;
    sendEmail?: boolean;
  }, sellerId: string, fullClient?: Client): Promise<{success: boolean, message: string, orderId?: string}> {
    const url = `${BASE_URL}/pedido`;
    const headers = { 
      'Content-Type': 'application/json', 'Accept': 'application/json',
      'Authorization': `Bearer ${sellerId}`
    };
    const bodyObj = {
      client_id: parseInt(clientId),
      notes: details.commit,
      discount: details.discount ? details.discount.toString() : "0",
      recargo: details.recargo ? details.recargo.toString() : "0",
      transport: details.transport || "",
      methodpay: details.methodpay || "",
      oemail: details.otheremail || "",
      iva: details.iva ? parseInt(String(details.iva)) : 0,
      send_email: details.sendEmail !== undefined ? details.sendEmail : true,
      products: items.map(i => {
        const parsedId = parseInt(i.id.toString().split('-')[0]);
        if (isNaN(parsedId)) return null;
        return { 
          product_id: parsedId, 
          variation_id: i.vid ? parseInt(i.vid) : undefined,
          quantity: i.quantity, 
          price: i.price
        };
      }).filter(p => p !== null)
    };
    const body = JSON.stringify(bodyObj);

    // Helper para guardar en Supabase como fallback
    const saveToSupabase = async () => {
      try {
        // Reconstruir items desde bodyObj
        const items: CartItem[] = bodyObj.products.map(p => ({
          id: p.product_id?.toString() || '',
          vid: p.variation_id?.toString(),
          name: '', // No tenemos el nombre aquí, se completa después
          price: p.price,
          quantity: p.quantity,
          stock: 0,
          category: '',
          description: '',
        }));

        // Usar fullClient si está disponible, sino crear uno básico
        const clientData: Client = fullClient || {
          id: clientId,
          name: '',
          email: '',
          phone: '',
          address: '',
        };

        await savePendingOrder(sellerId, clientData, items, {
          commit: details.commit,
          discount: details.discount,
          recargo: details.recargo,
          transport: details.transport,
          methodpay: details.methodpay,
          otheremail: details.otheremail,
          iva: details.iva,
        });
      } catch (e) {
        console.error('[API] Error saving pending order to Supabase:', e);
      }
    };

    if (!navigator.onLine) {
      // Guardar en IndexedDB para sincronización offline
      try {
        const dbRequest = indexedDB.open('tecnogafas-sync', 2);
        
        dbRequest.onerror = () => {
          console.error('Failed to open IndexedDB for offline order');
        };
        
        dbRequest.onsuccess = (e: Event) => {
          const db = (e.target as IDBOpenDBRequest).result;
          const tx = db.transaction('pending-orders', 'readwrite');
          tx.objectStore('pending-orders').put({
            id: Date.now().toString(),
            url,
            headers,
            body
          });
          // Solicitar sync al Service Worker si es posible
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then((reg: ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }) => {
              if (reg.sync) reg.sync.register('sync-orders');
            });
          }
        };
        
        // También guardar en Supabase como backup
        await saveToSupabase();
        
        return { success: false, message: 'Estás sin conexión. El pedido se guardó y se enviará automáticamente al recuperar red.' };
      } catch {
        return { success: false, message: 'Error al guardar pedido offline.' };
      }
    }

    try {
      const res = await customFetch(url, {
        method: 'POST',
        headers,
        body
      });
      
      let data;
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      
      let msg = data?.message || data?.data?.message || data?.error;
      if (!msg && typeof data === 'string') msg = data;
      if (!msg) msg = res.ok ? 'Pedido creado con éxito' : 'Error al crear el pedido';

      return { 
        success: res.ok, 
        message: msg,
        orderId: data?.order_id || data?.data?.order_id
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error de conexión con el servidor.';
      
      // Guardar en Supabase para reintento posterior
      try {
        const items: CartItem[] = bodyObj.products.map(p => ({
          id: p.product_id?.toString() || '',
          vid: p.variation_id?.toString(),
          name: '',
          price: p.price,
          quantity: p.quantity,
          stock: 0,
          category: '',
          description: '',
        }));

        // Usar fullClient si está disponible
        const clientData: Client = fullClient || {
          id: clientId,
          name: '',
          email: '',
          phone: '',
          address: '',
        };

        await savePendingOrder(sellerId, clientData, items, details);
        
        console.log('[API] Order saved to Supabase for retry after error');
      } catch (e) {
        console.error('[API] Error saving to Supabase after API failure:', e);
      }
      
      return { success: false, message: msg + ' (El pedido se guardó para reintentar)' };
    }
  },

  async saveClient(client: Partial<Client>): Promise<boolean> {
    const names = (client.name || '').split(' ');
    const firstName = names[0] || 'Cliente';
    const lastName = names.slice(1).join(' ') || '';
    
    // Si tiene ID, es una actualización (ej: /cliente/123). Si no, crea un nuevo cliente (/cliente)
    const url = client.id ? `${BASE_URL}/cliente/${client.id}` : `${BASE_URL}/cliente`;

    const res = await customFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        email: client.email || '',
        first_name: firstName,
        last_name: lastName,
        billing_phone: client.phone || '',
        billing_address_1: client.address || '',
        billing_city: client.billing_city || '',
        billing_state: client.billing_state || '',
        info_fiscal: client.cuit || ''
      })
    });
    return res.ok;
  },

  async loginSeller(pin: string): Promise<Seller | null> {
    const res = await customFetch(`${BASE_URL}/login?data=${encodeURIComponent(pin)}`, {
      method: 'POST'
    });
    if (!res.ok) {
      console.error('Login failed', res.status, await res.text());
      return null;
    }
    const json = await res.json();
    return {
      id: json.user?.id?.toString() || 'default_seller',
      name: json.user?.name || 'Vendedor'
    };
  },

  async downloadOrderPdf(orderId: string, sellerId: string): Promise<boolean> {
    try {
      const res = await customFetch(`${BASE_URL}/pedido/${orderId}/pdf`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sellerId}` }
      });
      if (!res.ok) return false;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Pedido_${orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  },

  async getLogs(context: string, sellerId: string): Promise<{ success: boolean; message: string; logs?: unknown[] }> {
    try {
      const res = await customFetch(`${BASE_URL}/logs`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${sellerId}`,
          'Content-Type': 'application/json', 'Accept': 'application/json'
        },
        body: JSON.stringify({ context })
      });
      return await res.json() as { success: boolean; message: string; logs?: unknown[] };
    } catch {
      console.error('Error fetching logs');
      return { success: false, message: 'Error de conexión' };
    }
  },

  async sendOrderEmail(orderId: string, sellerId: string): Promise<{success: boolean, message: string}> {
    try {
      const res = await customFetch(`${BASE_URL}/pedido/${orderId}/enviar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sellerId}` }
      });
      
      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text || 'Error desconocido' };
      }
      
      if (!res.ok) return { success: false, message: data.message || `Error al enviar email (Status: ${res.status})` };
      
      let msg = data.message || 'Email enviado exitosamente';
      if (data.recipients && Array.isArray(data.recipients)) {
        msg += ` a: ${data.recipients.join(', ')}`;
      }
      
      return { success: true, message: msg };
    } catch {
      return { success: false, message: 'Error de conexión' };
    }
  },

  async updateOrderStatus(orderId: string, status: 'attended' | 'unattended', sellerId: string): Promise<{success: boolean, message: string}> {
    try {
      const res = await customFetch(`${BASE_URL}/pedido/${orderId}/estado`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${sellerId}`,
          'Content-Type': 'application/json', 'Accept': 'application/json'
        },
        body: JSON.stringify({ status })
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
          // Invalidamos caché de productos globalmente para forzar recarga de stock
          cachedProducts = null;
          cachedProductsTimestamp = 0;
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

  async getSupabaseNotificationChannel(): Promise<{ data: { id: string } | null, error: any }> {
    const { supabase } = await import('../modules/chat/lib/supabase');
    return supabase
      .from('conversations')
      .select('id')
      .eq('slug', 'notificaciones')
      .single() as any;
  },

  async getSupabaseMemberStatus(conversationId: string, userId: string): Promise<{ data: { unread_count: number } | null, error: any }> {
    const { supabase } = await import('../modules/chat/lib/supabase');
    return supabase
      .from('conversation_members')
      .select('unread_count')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle() as any;
  },

  async subscribeToSupabaseTable(table: string, filter: string, callback: (payload: any) => void) {
    const { channelManager } = await import('../modules/chat/lib/supabase');
    const channelName = `global-${table}`;

    // Clean up any existing subscription to avoid "after subscribe" errors
    await channelManager.unsubscribe(channelName);

    const channel = channelManager.getChannel(channelName);
    
    // @ts-ignore
    if (channel.state === 'closed' || channel.state === 'errored') {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, callback);
    }
    await channelManager.subscribe(channelName);

    return channel;
  },

  async unsubscribeSupabase(channel: any) {
    if (!channel) return;
    const { channelManager } = await import('../modules/chat/lib/supabase');
    await channelManager.removeChannel(channel);
  },

  // ============================================================================
  // SUPABASE AUTH BRIDGE
  // ============================================================================

  async syncSupabaseAuth(pin: string) {
    if (!pin) return { error: 'PIN requerido' };
    
    const { supabase } = await import('../modules/chat/lib/supabase');
    const email = `vendedor+${pin}@tecnogafas.com.ar`;
    const password = `tg_${pin}_secure`; // Password derivado del PIN

    // 1. Intentar Login
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError) {
      console.log('✅ Supabase Auth sincronizado para:', email);
      return { session: signInData.session, user: signInData.user };
    }

    // 2. Si el usuario no existe (Error 400 - Invalid login credentials), intentar SignUp
    // Esto es útil para desarrollo y auto-provisión de vendedores.
    if (signInError.status === 400 || signInError.message.includes('Invalid login credentials')) {
      console.log('👷 Usuario no existe, intentando auto-registro...');
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: `Vendedor ${pin}`,
            pin: pin
          }
        }
      });

      if (signUpError) {
        console.error('❌ Error en auto-registro Supabase:', signUpError.message);
        return { error: signUpError.message };
      }

      console.log('✅ Usuario Supabase creado y sincronizado:', email);
      return { session: signUpData.session, user: signUpData.user };
    }

    console.error('❌ Error sincronizando Supabase Auth:', signInError.message);
    return { error: signInError.message };
  }
};
