import { Capacitor } from '@capacitor/core';
import { LoginRequestValidator, validateData } from '../lib/apiValidators';
import type { Seller, User } from '../types';

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

export const authService = {
  async loginSeller(pin: string): Promise<Seller | null> {
    // Validar payload con Zod
    const payloadValidation = validateData(LoginRequestValidator, { data: pin });
    if (!payloadValidation.success) {
      console.error('[Auth] PIN validation failed:', payloadValidation.error);
      return null;
    }

    const res = await customFetch(`${BASE_URL}/vendedor/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ data: pin }),
    });

    if (!res.ok) {
      console.error('[Auth] Login failed:', res.status);
      return null;
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      console.error('[Auth] Invalid response format:', json);
      return null;
    }

    return {
      id: json.data.id.toString(),
      name: json.data.nombre || json.data.name || '',
    };
  },

  async getUsers(sellerId?: string): Promise<User[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (sellerId) {
      headers.Authorization = `Bearer ${sellerId}`;
    }

    const res = await customFetch(`${BASE_URL}/users`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      console.error('[Auth] Failed to get users:', res.status);
      return [];
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      return [];
    }

    return json.data.map((user: unknown) => {
      // Type assertion since we don't have the exact API response type
      const userData = user as {
        id: number | string;
        username: string;
        name: string;
        email: string;
        first_name: string;
        last_name: string;
      };

      return {
        id: userData.id.toString(),
        username: userData.username,
        name: userData.name,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
      };
    });
  },

  async syncSupabaseAuth(pin: string) {
    if (!pin) return { error: 'PIN requerido' };

    const { supabase } = await import('../modules/chat/lib/supabase');

    try {
      // Primero obtener el vendedor desde nuestra API
      const seller = await this.loginSeller(pin);
      if (!seller) {
        return { error: 'PIN inválido' };
      }

      // Luego autenticar con Supabase usando el PIN como contraseña temporal
      const { data, error } = await supabase.auth.signInWithPassword({
        email: `vendedor_${seller.id}@tecnogafas.com.ar`,
        password: pin,
      });

      if (error) {
        // Si el usuario no existe, crearlo
        if (error.message.includes('Invalid login credentials')) {
          const { error: signUpError } = await supabase.auth.signUp({
            email: `vendedor_${seller.id}@tecnogafas.com.ar`,
            password: pin,
            options: {
              data: {
                seller_id: seller.id,
                seller_name: seller.name,
                role: 'seller',
              },
            },
          });

          if (signUpError) {
            return { error: 'Error creando usuario en chat' };
          }

          // Intentar login nuevamente
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: `vendedor_${seller.id}@tecnogafas.com.ar`,
            password: pin,
          });

          if (loginError) {
            return { error: 'Error autenticando en chat' };
          }

          return { success: true, user: loginData.user };
        }

        return { error: error.message };
      }

      return { success: true, user: data.user };
    } catch (error) {
      console.error('[Auth] Supabase sync error:', error);
      return { error: 'Error sincronizando autenticación' };
    }
  },
};
