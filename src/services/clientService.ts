import { Capacitor } from '@capacitor/core';
import type { ApiClient, Client } from '../types';

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

export const clientService = {
  async getClients(): Promise<Client[]> {
    const res = await customFetch(`${BASE_URL}/clientes`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = (await res.json()) as { data?: ApiClient[] };
    if (!json.data) return [];

    return json.data.map((apiClient) => ({
      id: apiClient.ID.toString(),
      name: apiClient.display_name,
      email: apiClient.user_email,
      phone: apiClient.billing_phone || '',
      address: apiClient.billing_address_1 || '',
      billing_city: apiClient.billing_city || '',
      billing_state: apiClient.billing_state || '',
      cuit: apiClient.info_fiscal || '',
    }));
  },

  async saveClient(client: Partial<Client>): Promise<boolean> {
    const sellerId = localStorage.getItem('seller_id');
    const [firstName, ...lastNames] = (client.name || '').split(' ');
    const lastName = lastNames.join(' ');

    const payload = {
      first_name: firstName || '',
      last_name: lastName || '',
      email: client.email || '',
      billing_phone: client.phone || '',
      billing_address_1: client.address || '',
      billing_city: client.billing_city || '',
      billing_state: client.billing_state || '',
      info_fiscal: client.cuit || '',
      seller_id: sellerId,
    };

    const res = await customFetch(`${BASE_URL}/clientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return res.ok;
  },
};
