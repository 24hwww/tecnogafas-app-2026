import { Capacitor } from '@capacitor/core';
import type { ApiOrder, CartItem, Client, Order } from '../types';
import { savePendingOrder } from './pendingOrdersSync';

const REAL_API_URL = 'https://api.tecnogafas.com.ar';
const PROXY_API_URL = '/api';
const BASE_URL = Capacitor.isNativePlatform() ? REAL_API_URL : PROXY_API_URL;
const FETCH_TIMEOUT = 30000; // 30 seconds

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

export const orderService = {
  async getOrders(
    page: number = 1,
    perPage: number = 25,
    sellerId?: number | string,
  ): Promise<{ orders: Order[]; total: number }> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });

    if (sellerId) {
      params.append('seller_id', sellerId.toString());
    }

    const res = await customFetch(`${BASE_URL}/pedidos?${params}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const json = (await res.json()) as { data?: ApiOrder[]; total?: number };
    const orders: Order[] = (json.data || []).map((apiOrder) => ({
      id: apiOrder.ID.toString(),
      clientId: apiOrder.customer_id.toString(),
      clientName: apiOrder.customer?.display_name || '',
      items: (apiOrder.items || []).map((item) => ({
        productId: item.product_id.toString(),
        productName: item.name,
        quantity: item.quantity,
        price: item.price,
        vid: item.vid,
      })),
      total:
        typeof apiOrder.order_total === 'string'
          ? parseFloat(apiOrder.order_total.replace(/[^0-9.]/g, ''))
          : Number(apiOrder.order_total),
      status: apiOrder.post_status === 'wc-completed' ? 'attended' : 'unattended',
      createdAt: apiOrder.post_date,
      sellerId: apiOrder.seller_id.toString(),
      sellerName: apiOrder.seller_name,
      rawData: apiOrder,
    }));

    return { orders, total: json.total || orders.length };
  },

  async createOrder(
    clientId: string,
    items: Array<{ id: string; vid?: string; price: number; quantity: number }>,
    details: {
      iva: number;
      discount: number;
      recargo: number;
      methodpay: string;
      transport: string;
      commit: string;
      otheremail: string;
      sendEmail?: boolean;
    },
    sellerId: string,
    client?: Client,
  ): Promise<{ success: boolean; orderId?: string; message?: string }> {
    const url = `${BASE_URL}/pedido`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${sellerId}`,
    };

    const bodyObj = {
      customer_id: parseInt(clientId),
      products: items,
      details,
    };

    const body = JSON.stringify(bodyObj);

    const enqueuePendingOrder = async () => {
      const pendingItems: CartItem[] = bodyObj.products.map((p) => ({
        id: p.id.toString(),
        name: '',
        category: '',
        price: p.price,
        stock: 0,
        quantity: p.quantity,
        vid: p.vid,
        description: '',
      }));

      await savePendingOrder(
        sellerId,
        client || { id: clientId, name: '', email: '', phone: '', address: '' },
        pendingItems,
        details,
      );
    };

    if (!navigator.onLine) {
      try {
        await enqueuePendingOrder();
        return {
          success: false,
          message:
            'Estás sin conexión. El pedido se guardó y se enviará automáticamente al recuperar red.',
        };
      } catch {
        return { success: false, message: 'Error al guardar pedido offline.' };
      }
    }

    try {
      const res = await customFetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (!res.ok) {
        // Guardar como pendiente si falla
        await enqueuePendingOrder();
        throw new Error(`API error: ${res.status}`);
      }

      const result = await res.json();
      return result;
    } catch (error) {
      // Guardar como pendiente ante cualquier error
      await enqueuePendingOrder();
      return {
        success: false,
        message: 'Error de conexión. Pedido guardado para sincronización.',
      };
    }
  },

  async updateOrderStatus(
    orderId: string,
    status: 'attended' | 'unattended',
    sellerId: string,
  ): Promise<{ success: boolean; message: string }> {
    const res = await customFetch(`${BASE_URL}/pedido/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerId}`,
      },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        message: errorText || 'Error al actualizar estado del pedido',
      };
    }

    const result = await res.json();
    return result;
  },

  async downloadOrderPdf(orderId: number): Promise<Blob | false> {
    const sellerId = localStorage.getItem('seller_id');
    try {
      const res = await customFetch(`${BASE_URL}/pedido/${orderId}/pdf`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sellerId}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        console.error('Error downloading PDF:', res.status);
        return false;
      }

      return await res.blob();
    } catch (error) {
      console.error('Error downloading PDF:', error);
      return false;
    }
  },

  async sendOrderEmail(
    orderId: string,
    sellerId: string,
  ): Promise<{ success: boolean; message: string }> {
    const res = await customFetch(`${BASE_URL}/pedido/${orderId}/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerId}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        message: errorText || 'Error al enviar email del pedido',
      };
    }

    const result = await res.json();
    return result;
  },
};
