import { ApiProduct, ApiClient, ApiOrder, Product, Client, Order, Seller } from '../types';

const BASE_URL = 'https://api.tecnogafas.com.ar';

export const apiService = {
  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${BASE_URL}/productos`);
    const json = await res.json();
    return (json.data || []).map((p: ApiProduct) => {
      // Parse variations to get a price and stock
      // e.g. "vid:23726|Título:5508 - C1 - BLACK|Stock:6|Precio:58000;..."
      const variations = (p.variaciones || '').split(';');
      const firstVar = variations[0] || '';
      const priceMatch = firstVar.match(/Precio:(\d+)/);
      const stockMatch = firstVar.match(/Stock:(\d+)/);
      
      const filtros = p.filtros || '';
      const category = filtros.includes('Post:') ? 'Otros' : (filtros.split('|')[0] || 'General').replace('Termino:', '');

      return {
        id: p.pid.toString(),
        name: p.nombre_producto,
        category,
        price: priceMatch ? parseInt(priceMatch[1]) : 0,
        stock: stockMatch ? parseInt(stockMatch[1]) : 0,
        description: filtros,
      };
    });
  },

  async getClients(): Promise<Client[]> {
    const res = await fetch(`${BASE_URL}/clientes`);
    const json = await res.json();
    return (json.data || []).map((c: ApiClient) => ({
      id: c.ID.toString(),
      name: c.display_name,
      email: c.user_email,
      phone: c.billing_phone || '',
      address: c.billing_address_1 || '',
    }));
  },

  async getOrders(): Promise<Order[]> {
    const res = await fetch(`${BASE_URL}/pedidos`);
    const json = await res.json();
    return (json.data || []).map((o: ApiOrder) => ({
      id: o.ID.toString(),
      clientId: o.customer_id?.toString() || '',
      clientName: o.post_title.split('-')[0].replace('Pedido: ', ''),
      items: [],
      total: o.order_total ? parseFloat(o.order_total) : 0,
      status: o.post_status === 'unattended' ? 'Pendiente' : 'Completado',
      createdAt: o.post_date,
    }));
  },

  async createOrder(clientId: string, items: any[], details: any, sellerId: string): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/pedido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: clientId,
        seller_id: sellerId,
        items: items.map(i => ({ id: i.id, quantity: i.quantity, price: i.price })),
        iva: details.iva,
        discount: details.discount,
        recargo: details.recargo,
        methodpay: details.methodpay,
        transport: details.transport,
        commit: details.commit,
        otheremail: details.otheremail,
        total_calc: details.total_calc
      })
    });
    return res.ok;
  },

  async saveClient(client: Partial<Client>): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/cliente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ID: client.id || 0,
        display_name: client.name,
        user_email: client.email,
        description: `Phone: ${client.phone} | Address: ${client.address}`
      })
    });
    return res.ok;
  },

  async loginSeller(pin: string): Promise<Seller | null> {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    if (!res.ok) return null;
    const json = await res.json();
    return {
      id: json.data?.id || 'default_seller',
      name: json.data?.name || 'Vendedor'
    };
  }
};
