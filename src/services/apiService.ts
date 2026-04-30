import { ApiProduct, ApiClient, ApiOrder, Product, Client, Order, Seller } from '../types';

const BASE_URL = 'https://api.tecnogafas.com.ar';

let cachedProducts: Product[] | null = null;
let cachedProductsTimestamp: number = 0;
const CACHE_PRODUCTS_TTL = 5 * 60 * 1000; // 5 minutes

let cachedEvents: any[] | null = null;
let cachedEventsTimestamp: number = 0;
const CACHE_EVENTS_TTL = 60 * 1000; // 1 minute
let hasEventsApiFailed: boolean = false;

const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    const res = await fetch(input, {
      cache: 'no-store', // Always fetch latest data
      ...init
    });
    if (!res.ok) {
      console.warn(`⚠️ API call to ${input} returned status ${res.status}`);
      if (res.status >= 500) {
        window.dispatchEvent(new CustomEvent('api-error', { detail: { message: `Servidor devolvió error ${res.status}` } }));
      }
    }
    return res;
  } catch (err: any) {
    console.error(`❌ Fetch error for ${input}:`, err);
    window.dispatchEvent(new CustomEvent('api-error', { detail: { message: 'No se pudo conectar con la API (caída o sin red)' } }));
    throw err;
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
    const json = await res.json();
    cachedProducts = (json.data || []).map((p: any) => {
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
    const json = await res.json();
    return (json.data || []).map((c: ApiClient) => ({
      id: c.ID?.toString() || Math.random().toString(),
      name: c.display_name || '',
      email: c.user_email || '',
      phone: c.billing_phone || '',
      address: c.billing_address_1 || '',
    }));
  },

  async getOrders(page: number = 1, perPage: number = 25, sellerId?: number | string, customerId?: number | string): Promise<{ orders: Order[], total: number }> {
    let url = `${BASE_URL}/pedidos?page=${page}&per_page=${perPage}`;
    if (sellerId) url += `&seller_id=${sellerId}`;
    if (customerId) url += `&customer_id=${customerId}`;
    
    const headers = sellerId ? { 'Authorization': `Bearer ${sellerId}` } : {};
    
    const res = await customFetch(url, { headers });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = await res.json();
    const orders = (json.data || []).map((o: ApiOrder) => ({
      id: o.ID?.toString() || Math.random().toString(),
      clientId: o.customer_id?.toString() || '',
      clientName: o.customer ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() : 'Sin cliente',
      items: (o.items || []).map(i => ({
        productId: i.product_id?.toString() || '',
        productName: i.name || '',
        quantity: i.quantity || 0,
        price: i.price || 0,
      })),
      total: o.order_total ? parseFloat(o.order_total.toString()) : 0,
      status: o.post_status === 'unattended' ? 'Pendiente' : 'Completado',
      createdAt: o.post_date || '',
      sellerId: o.post_author?.toString() || '',
      rawData: {
        ...o,
        customer_note: o.observaciones || o.customer_note || (o as any).notes || '', // Handle different possible field names
      },
    }));
    return { orders, total: parseInt(json.total) || orders.length };
  },

  async verifyProducts(products: {product_id: number, variation_id?: number, price: number, stock: number}[]): Promise<{
    success: boolean;
    message: string;
    total?: number;
    verified?: number;
    failed?: number;
    results?: any[];
  }> {
    try {
      const res = await customFetch(`${BASE_URL}/producto/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    const json = await res.json();
    return (json.data || []).map((s: any) => ({
      id: s.ID?.toString() || Math.random().toString(),
      name: s.display_name || 'Sin nombre',
    }));
  },

  async getAppVersion(): Promise<any> {
    try {
      const res = await customFetch(`${BASE_URL}/app/version`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      console.error('Error fetching app version', e);
      return null;
    }
  },

  async getEvents(type?: string, sellerId?: string): Promise<any[]> {
    if (hasEventsApiFailed) return [];
    
    if (!type && cachedEvents && (Date.now() - cachedEventsTimestamp < CACHE_EVENTS_TTL)) {
      console.log('📦 Using cached events');
      return cachedEvents;
    }

    const url = new URL(`${BASE_URL}/events/list`);
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sellerId) {
      headers['Authorization'] = `Bearer ${sellerId}`;
    }
    
    const body: Record<string, any> = { limit: 100 };
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

  extractEvents(json: any): any[] {
    // Robust extraction: handle { events: [] }, { data: [] }, { data: { events: [] } }, etc.
    let list = json.events || json.notifications || json.data || [];
    if (!Array.isArray(list) && list !== null && typeof list === 'object') {
      list = list.events || list.notifications || list.data || [];
    }
    
    if (!Array.isArray(list)) return [];
    
    // Normalize events: ensure 'id' exists and 'read' is boolean
    return list.map((n: any) => ({
      ...n,
      id: n.id || n.ID || n.event_id,
      read: n.read === 1 || n.read === true || n.status === 'read' || n.readed === 1
    }));
  },

  async createEvent(data: { user_id: number; type: 'message' | 'notification' | string; from_id?: number; content: any; read?: number }, sellerId?: string): Promise<any> {
    const headers = { 
      'Content-Type': 'application/json',
      ...(sellerId ? { 'Authorization': `Bearer ${sellerId}` } : {})
    };
    const res = await customFetch(`${BASE_URL}/event`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getUnreadCount(sellerId?: string): Promise<number> {
    try {
      const url = new URL(`${BASE_URL}/events/unread`);
      if (sellerId) url.searchParams.set('pin', sellerId);
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sellerId) headers['Authorization'] = `Bearer ${sellerId}`;
      const res = await customFetch(url.toString(), { method: 'POST', headers });
      if (!res.ok) return 0;
      const json = await res.json();
      return json.unread || json.count || 0;
    } catch (e) {
      console.warn('Silent fail for unread count', e);
      return 0;
    }
  },

  async ackEvent(id: number, sellerId?: string): Promise<any> {
    const headers = { 
      'Content-Type': 'application/json',
      ...(sellerId ? { 'Authorization': `Bearer ${sellerId}` } : {})
    };
    const res = await customFetch(`${BASE_URL}/ack`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id })
    });
    return res.json();
  },

  async createOrder(clientId: string, items: any[], details: any, sellerId: string): Promise<{success: boolean, message: string, orderId?: string}> {
    const url = `${BASE_URL}/pedido`;
    const headers = { 
      'Content-Type': 'application/json',
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
      iva: details.iva ? parseInt(details.iva) : 0,
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
    console.log("DEBUG: Sending order body:", body);

    if (!navigator.onLine) {
      return { success: false, message: 'Estás sin conexión. Guardaremos esto como un borrador para que lo envíes luego.' };
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
      } catch (e) {
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
    } catch (error: any) {
      return { success: false, message: error?.message || 'Error de conexión con el servidor.' };
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: client.email || '',
        first_name: firstName,
        last_name: lastName,
        billing_phone: client.phone || '',
        billing_address: client.address || ''
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

  async getLogs(context: string, sellerId: string): Promise<any> {
    try {
      const res = await customFetch(`${BASE_URL}/logs`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${sellerId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ context })
      });
      return await res.json();
    } catch(e) {
      console.error('Error fetching logs', e);
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
      } catch (e) {
        data = { message: text || 'Error desconocido' };
      }
      
      if (!res.ok) return { success: false, message: data.message || `Error al enviar email (Status: ${res.status})` };
      
      let msg = data.message || 'Email enviado exitosamente';
      if (data.recipients && Array.isArray(data.recipients)) {
        msg += ` a: ${data.recipients.join(', ')}`;
      }
      
      return { success: true, message: msg };
    } catch (e: any) {
      return { success: false, message: 'Error de conexión' };
    }
  },

  async updateOrderStatus(orderId: string, status: 'attended' | 'unattended', sellerId: string): Promise<{success: boolean, message: string}> {
    try {
      const res = await customFetch(`${BASE_URL}/pedido/${orderId}/estado`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${sellerId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.message || 'Error al actualizar estado' };
      return { success: true, message: data.message || 'Estado actualizado' };
    } catch (e: any) {
      return { success: false, message: 'Error de conexión' };
    }
  },

  subscribeToEvents(onMessage: (data: any) => void) {
    const eventSource = new EventSource(`${BASE_URL}/events/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (e) {
        console.error('Error parsing SSE data', e);
      }
    };
    
    eventSource.onerror = (err) => {
      console.error('SSE error', err);
      // EventSource automatically attempts to reconnect
    };
    
    return () => eventSource.close();
  }
};
