import { Capacitor } from '@capacitor/core';
import type { ApiProduct, Product } from '../types';

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

export const productService = {
  async getProducts(): Promise<Product[]> {
    const res = await customFetch(`${BASE_URL}/productos`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const json = (await res.json()) as { data?: ApiProduct[] };
    if (!json.data) return [];

    const mappedProducts: Product[] = json.data.map((apiProduct) => {
      // Parse variaciones (puede ser string JSON o null)
      let variations: Product['variations'] = [];
      try {
        if (apiProduct.variaciones) {
          const parsed = JSON.parse(apiProduct.variaciones);
          if (Array.isArray(parsed)) {
            variations = parsed.map((v) => ({
              vid: v.vid || v.variation_id || '',
              title: v.title || v.nombre || '',
              stock: v.stock || 0,
              price: v.price || v.precio || 0,
            }));
          }
        }
      } catch (e) {
        console.warn('Error parsing variaciones:', e);
      }

      return {
        id: apiProduct.product_id.toString(),
        name: apiProduct.nombre_producto,
        category: '', // No viene de la API
        price: 0, // Se obtiene de variaciones
        stock: variations.reduce((sum, v) => sum + v.stock, 0),
        image: '',
        description: '',
        variations,
      };
    });

    return mappedProducts;
  },

  async verifyProducts(
    products: { product_id: number; variation_id?: number; price: number; stock: number }[],
    sellerId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    invalid?: Array<{ product_id: number; reason: string }>;
  }> {
    const payload = {
      products,
      seller_id: sellerId,
    };

    const res = await customFetch(`${BASE_URL}/verificar-productos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    return json;
  },
};
