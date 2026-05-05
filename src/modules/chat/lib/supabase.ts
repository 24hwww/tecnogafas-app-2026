// ============================================================================
// SUPABASE CLIENT - CONFIGURACIÓN REALTIME
// Arquitectura: Reconexión automática + Manejo de canales
// ============================================================================

import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

// ============================================================================
// OPCIONES DE REALTIME
// ============================================================================

const REALTIME_CONFIG = {
  // Reconexión automática
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  // Configuración de auth
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  // Timeouts y retries
  db: {
    schema: 'public',
  },
} as const;

// ============================================================================
// CLIENTE SUPABASE TIPADO
// ============================================================================

export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  REALTIME_CONFIG
);

// ============================================================================
// GESTOR DE CANALES REALTIME
// ============================================================================

class RealtimeChannelManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // ms base delay

  /**
   * Obtener o crear un canal
   */
  getChannel(channelName: string): RealtimeChannel {
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: {
          self: false, // No recibir mis propios mensajes
        },
        presence: {
          key: '',
        },
      },
    });

    this.channels.set(channelName, channel);
    return channel;
  }

  /**
   * Suscribirse a un canal con manejo de errores y reconexión
   */
  async subscribe(
    channelName: string,
    callbacks: {
      onSubscribe?: () => void;
      onError?: (error: Error) => void;
      onClose?: () => void;
    } = {}
  ): Promise<RealtimeChannel> {
    const channel = this.getChannel(channelName);

    return new Promise((resolve, reject) => {
      channel
        .on('system', { event: '*' }, (payload) => {
          // Manejar eventos de sistema (connect, disconnect, etc)
          if (payload.event === 'connected') {
            this.reconnectAttempts.set(channelName, 0);
          }
        })
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            callbacks.onSubscribe?.();
            resolve(channel);
          } else if (status === 'CHANNEL_ERROR') {
            this.handleReconnect(channelName, callbacks);
            callbacks.onError?.(err || new Error('Channel error'));
            reject(err);
          } else if (status === 'CLOSED') {
            callbacks.onClose?.();
            this.channels.delete(channelName);
          } else if (status === 'TIMED_OUT') {
            this.handleReconnect(channelName, callbacks);
            reject(new Error('Subscription timed out'));
          }
        });
    });
  }

  /**
   * Manejar reconexión automática con backoff exponencial
   */
  private handleReconnect(
    channelName: string,
    callbacks: {
      onSubscribe?: () => void;
      onError?: (error: Error) => void;
      onClose?: () => void;
    }
  ): void {
    const attempts = this.reconnectAttempts.get(channelName) || 0;

    if (attempts >= this.maxReconnectAttempts) {
      console.error(`[Realtime] Max reconnect attempts reached for ${channelName}`);
      callbacks.onError?.(new Error('Max reconnect attempts reached'));
      return;
    }

    this.reconnectAttempts.set(channelName, attempts + 1);

    // Backoff exponencial con jitter
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, attempts) + Math.random() * 1000,
      30000 // Max 30 segundos
    );

    console.log(`[Realtime] Reconnecting ${channelName} in ${delay}ms (attempt ${attempts + 1})`);

    setTimeout(() => {
      this.channels.delete(channelName);
      this.subscribe(channelName, callbacks).catch(() => {
        // Error manejado en el reject
      });
    }, delay);
  }

  /**
   * Desuscribirse de un canal
   */
  async unsubscribe(channelName: string): Promise<void> {
    const channel = this.channels.get(channelName);
    if (channel) {
      await channel.unsubscribe();
      this.channels.delete(channelName);
      this.reconnectAttempts.delete(channelName);
    }
  }

  /**
   * Desuscribirse de todos los canales
   */
  async unsubscribeAll(): Promise<void> {
    const promises = Array.from(this.channels.keys()).map((name) =>
      this.unsubscribe(name)
    );
    await Promise.all(promises);
    this.channels.clear();
    this.reconnectAttempts.clear();
  }

  /**
   * Verificar si un canal está activo
   */
  isSubscribed(channelName: string): boolean {
    const channel = this.channels.get(channelName);
    if (!channel) return false;
    
    return (channel as unknown as { subscribed?: boolean }).subscribed === true;
  }

  /**
   * Obtener lista de canales activos
   */
  getActiveChannels(): string[] {
    return Array.from(this.channels.keys()).filter((name) =>
      this.isSubscribed(name)
    );
  }
}

// ============================================================================
// INSTANCIA GLOBAL DEL GESTOR
// ============================================================================

export const channelManager = new RealtimeChannelManager();

// ============================================================================
// HELPERS PARA DATABASE
// ============================================================================

/**
 * Helper para queries con retry
 */
export async function queryWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Si es el último intento, throw
      if (attempt === maxRetries - 1) {
        throw lastError;
      }

      // Esperar antes de retry
      await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt)));
    }
  }

  throw lastError || new Error('Query failed after retries');
}

/**
 * Verificar conexión a Supabase
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Obtener URL firmada para storage (si se usa)
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 60
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data) {
    console.error('Error getting signed URL:', error);
    return null;
  }

  return data.signedUrl;
}

// ============================================================================
// EVENTOS DE SISTEMA (online/offline)
// ============================================================================

export function subscribeToSystemEvents(
  callbacks: {
    onOnline?: () => void;
    onOffline?: () => void;
  }
): () => void {
  const handleOnline = () => {
    console.log('[Supabase] Connection restored');
    callbacks.onOnline?.();
  };

  const handleOffline = () => {
    console.log('[Supabase] Connection lost');
    callbacks.onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// ============================================================================
// CLEANUP
// ============================================================================

export async function cleanupSupabase(): Promise<void> {
  await channelManager.unsubscribeAll();
  await supabase.removeAllChannels();
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { RealtimeChannel, SupabaseClient };
