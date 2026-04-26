import { ApiProduct, ApiClient, ApiOrder, Product, Client, Order, Seller } from '../types';

const BASE_URL = 'https://api.tecnogafas.com.ar';

export const apiService = {
  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${BASE_URL}/productos`);
    const json = await res.json();
    return (json.data || []).map((p: any) => {
      // Parse variations e.g. "variation_id:23726|Título:5508 - C1 - BLACK|Stock:6|Precio:58000;..."
      const variations = (p.variaciones || '').split(';').filter((v: string) => v.trim() !== '').map((v: string) => {
        const parts = v.split('|');
        const vid = parts[0]?.split(':')[1] || '';
        const title = parts[1]?.split(':')[1] || '';
        const stock = parseInt(parts[2]?.split(':')[1] || '0');
        const price = parseFloat(parts[3]?.split(':')[1] || '0');
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
  },

  async getClients(): Promise<Client[]> {
    const res = await fetch(`${BASE_URL}/clientes`);
    const json = await res.json();
    return (json.data || []).map((c: ApiClient) => ({
      id: c.ID?.toString() || Math.random().toString(),
      name: c.display_name || '',
      email: c.user_email || '',
      phone: c.billing_phone || '',
      address: c.billing_address_1 || '',
    }));
  },

  async getOrders(): Promise<Order[]> {
    const res = await fetch(`${BASE_URL}/pedidos`);
    const json = await res.json();
    return (json.data || []).map((o: ApiOrder) => ({
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
      rawData: o,
    }));
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
      const res = await fetch(`${BASE_URL}/producto/verificar`, {
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
    const res = await fetch(`${BASE_URL}/usuarios`);
    const json = await res.json();
    return (json.data || []).map((s: any) => ({
      id: s.ID?.toString() || Math.random().toString(),
      name: s.display_name || 'Sin nombre',
    }));
  },

  async createOrder(clientId: string, items: any[], details: any, sellerId: string): Promise<{success: boolean, message: string}> {
    try {
      const res = await fetch(`${BASE_URL}/pedido`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sellerId}`
        },
        body: JSON.stringify({
          client_id: parseInt(clientId),
          notes: details.commit,
          discount: details.discount ? details.discount.toString() : "0",
          recargo: details.recargo ? details.recargo.toString() : "0",
          transport: details.transport || "",
          methodpay: details.methodpay || "",
          iva: details.iva ? parseInt(details.iva) : 0,
          products: items.map(i => {
            const itemBody: any = { 
              product_id: parseInt(i.id.split('-')[0]), 
              quantity: i.quantity, 
              price: i.price 
            };
            if (i.vid) {
              itemBody.variation_id = parseInt(i.vid);
            }
            return itemBody;
          })
        })
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
        message: msg 
      };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Error de conexión' };
    }
  },

  async saveClient(client: Partial<Client>): Promise<boolean> {
    const names = (client.name || '').split(' ');
    const firstName = names[0] || 'Cliente';
    const lastName = names.slice(1).join(' ') || '';
    
    // Si tiene ID, es una actualización (ej: /cliente/123). Si no, crea un nuevo cliente (/cliente)
    const url = client.id ? `${BASE_URL}/cliente/${client.id}` : `${BASE_URL}/cliente`;

    const res = await fetch(url, {
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
    const res = await fetch(`${BASE_URL}/login?data=${encodeURIComponent(pin)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: pin })
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
      const res = await fetch(`${BASE_URL}/pedido/${orderId}/pdf`, {
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

  async sendOrderEmail(orderId: string, sellerId: string): Promise<{success: boolean, message: string}> {
    try {
      const res = await fetch(`${BASE_URL}/pedido/${orderId}/enviar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sellerId}` }
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.message || 'Error al enviar email' };
      return { success: true, message: data.message || 'Email enviado exitosamente' };
    } catch (e: any) {
      return { success: false, message: 'Error de conexión' };
    }
  }
};
