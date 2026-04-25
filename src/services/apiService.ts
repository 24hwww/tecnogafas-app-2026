import { ApiProduct, ApiClient, ApiOrder, Product, Client, Order, Seller } from '../types';

const BASE_URL = 'https://api.tecnogafas.com.ar';

export const apiService = {
  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${BASE_URL}/productos`);
    const json = await res.json();
    return (json.data || []).map((p: ApiProduct) => {
      // Parse variations e.g. "vid:23726|Título:5508 - C1 - BLACK|Stock:6|Precio:58000;..."
      const variations = (p.variaciones || '').split(';').filter(v => v.trim() !== '').map(v => {
        const parts = v.split('|');
        const vid = parts[0]?.split(':')[1] || '';
        const title = parts[1]?.split(':')[1] || '';
        const stock = parseInt(parts[2]?.split(':')[1] || '0');
        const price = parseInt(parts[3]?.split(':')[1] || '0');
        return { vid, title, stock, price };
      });

      const filtros = p.filtros || '';
      const category = filtros.includes('Post:') ? 'Otros' : (filtros.split('|')[0] || 'General').replace('Termino:', '');

      return {
        id: p.pid.toString(),
        name: p.nombre_producto,
        category,
        price: variations[0]?.price || 0,
        stock: variations.reduce((acc, v) => acc + v.stock, 0),
        description: filtros,
        variations
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
      clientName: o.customer ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() : 'Sin cliente',
      items: (o.items || []).map(i => ({
        productId: i.product_id.toString(),
        productName: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
      total: o.order_total ? parseFloat(o.order_total.toString()) : 0,
      status: o.post_status === 'unattended' ? 'Pendiente' : 'Completado',
      createdAt: o.post_date,
      sellerId: o.post_author.toString(),
      rawData: o,
    }));
  },

  async getSellers(): Promise<Seller[]> {
    const res = await fetch(`${BASE_URL}/usuarios`);
    const json = await res.json();
    return (json.data || []).map((s: any) => ({
      id: s.id?.toString() || Math.random().toString(),
      name: s.name || 'Sin nombre',
    }));
  },

  async createOrder(clientId: string, items: any[], details: any, sellerId: string): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/pedido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: clientId,
        seller_id: sellerId,
        items: items.map(i => {
          const itemBody: any = { id: i.id, quantity: i.quantity, price: i.price };
          if (i.vid) itemBody.vid = i.vid;
          return itemBody;
        }),
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
      body: JSON.stringify({ PIN: pin })
    });
    if (!res.ok) {
      console.error('Login failed', res.status, await res.text());
      return null;
    }
    const json = await res.json();
    return {
      id: json.data?.id || 'default_seller',
      name: json.data?.name || 'Vendedor'
    };
  }
};
