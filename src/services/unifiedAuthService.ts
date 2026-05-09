import { Capacitor } from '@capacitor/core';
import { LoginRequestValidator, validateData } from '../lib/apiValidators';
import type { Seller, User, SupabaseUser } from '../types';

const REAL_API_URL = 'https://api.tecnogafas.com.ar';
const PROXY_API_URL = '/api';
const BASE_URL = Capacitor.isNativePlatform() ? REAL_API_URL : PROXY_API_URL;
const FETCH_TIMEOUT = 30000; // 30 seconds

interface FetchError extends Error {
  name: string;
  message: string;
}

interface AuthResult {
  success: boolean;
  seller?: Seller | null;
  supabaseUser?: SupabaseUser | null;
  error?: string;
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

export const unifiedAuthService = {
  /**
   * Autentica un vendedor usando el PIN global
   * Primero autentica contra la API del backend, luego contra Supabase
   */
  async authenticateWithPin(pin: string): Promise<AuthResult> {
    // Validar PIN con Zod
    const payloadValidation = validateData(LoginRequestValidator, { data: pin });
    if (!payloadValidation.success) {
      console.error('[UnifiedAuth] PIN validation failed:', payloadValidation.error);
      return { success: false, error: 'PIN inválido' };
    }

    try {
      // 1. Autenticar contra API del backend
      const seller = await this.authenticateWithAPI(pin);
      if (!seller) {
        return { success: false, error: 'PIN inválido en el backend' };
      }

      // 2. Autenticar contra Supabase
      const supabaseUser = await this.authenticateWithSupabase(seller.id, pin);
      if (!supabaseUser) {
        return { success: false, error: 'Error autenticando con Supabase' };
      }

      return { 
        success: true, 
        seller, 
        supabaseUser 
      };
    } catch (error) {
      console.error('[UnifiedAuth] Authentication error:', error);
      return { success: false, error: 'Error en la autenticación' };
    }
  },

  /**
   * Autentica contra la API del backend
   */
  async authenticateWithAPI(pin: string): Promise<Seller | null> {
    const res = await customFetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ data: pin }),
    });

    if (!res.ok) {
      console.error('[UnifiedAuth] API login failed:', res.status);
      return null;
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      console.error('[UnifiedAuth] Invalid API response format:', json);
      return null;
    }

    return {
      id: json.data.id.toString(),
      name: json.data.nombre || json.data.name || '',
    };
  },

  /**
   * Autentica contra Supabase usando el seller_id y PIN
   * Email format: vendedor_{seller_id}@tecnogafas.com.ar
   * Password: PIN (mismo que backend)
   */
  async authenticateWithSupabase(sellerId: string, pin: string): Promise<SupabaseUser | null> {
    const { supabase } = await import('../modules/chat/lib/supabase');
    const email = `vendedor_${sellerId}@tecnogafas.com.ar`;

    try {
      // 1. Intentar login
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: pin,
      });

      if (!signInError) {
        console.log('✅ Supabase Auth successful for:', email);
        return signInData.user as SupabaseUser;
      }

      // 2. Si el usuario no existe, crearlo
      if (signInError.message.includes('Invalid login credentials')) {
        console.log('👷 Creating Supabase user for:', email);
        
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password: pin,
          options: {
            data: {
              seller_id: sellerId,
              seller_name: `Vendedor ${sellerId}`,
              role: 'seller',
              pin: pin,
            },
          },
        });

        if (signUpError) {
          console.error('❌ Error creating Supabase user:', signUpError.message);
          return null;
        }

        // 3. Intentar login nuevamente después del signup
        const { data: retrySignInData, error: retrySignInError } = await supabase.auth.signInWithPassword({
          email,
          password: pin,
        });

        if (retrySignInError) {
          console.error('❌ Error in retry Supabase login:', retrySignInError.message);
          return null;
        }

        console.log('✅ Supabase user created and authenticated:', email);
        return retrySignInData.user as SupabaseUser;
      }

      console.error('❌ Supabase auth error:', signInError.message);
      return null;
    } catch (error) {
      console.error('[UnifiedAuth] Supabase authentication error:', error);
      return null;
    }
  },

  /**
   * Desvincula completamente al vendedor (backend + Supabase)
   */
  async unlinkAccount(): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Cerrar sesión en Supabase
      const { supabase } = await import('../modules/chat/lib/supabase');
      await supabase.auth.signOut();

      // 2. Limpiar estado local
      localStorage.removeItem('tecnogafas_pin');

      // 3. Detener polling del service worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'STOP_POLLING' });
      }

      console.log('✅ Account successfully unlinked from all systems');
      return { success: true };
    } catch (error) {
      console.error('[UnifiedAuth] Error unlinking account:', error);
      return { success: false, error: 'Error desvinculando cuenta' };
    }
  },

  /**
   * Obtiene la lista de usuarios (manteniendo compatibilidad)
   */
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
      console.error('[UnifiedAuth] Failed to get users:', res.status);
      return [];
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      return [];
    }

    return json.data.map((user: unknown) => {
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

  /**
   * Verifica si un PIN es válido sin autenticar completamente
   */
  async validatePin(pin: string): Promise<boolean> {
    const seller = await this.authenticateWithAPI(pin);
    return seller !== null;
  },
};
