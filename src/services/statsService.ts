// ============================================================================
// SERVICIO DE ESTADÍSTICAS
// Gestiona actualizaciones de estadísticas locales y sincronización
// ============================================================================

interface LocalStats {
  total_orders: number;
  total_clients: number;
  total_products: number;
  total_sellers: number;
  recent_orders: number;
  pending_orders: number;
  pedidos_ultimas_24h: number;
  items_ultimas_24h: number;
  pedidos_mes_actual: number;
  items_mes_actual: number;
  productos_mas_pedidos_24h: Array<{
    product_id: number;
    variation_id: number;
    name: string;
    total_quantity: number;
    order_count: number;
  }>;
  productos_mas_pedidos_mes: Array<{
    product_id: number;
    variation_id: number;
    name: string;
    total_quantity: number;
    order_count: number;
  }>;
}

/**
 * Incrementa el contador de pedidos en las estadísticas locales
 */
export function incrementOrderStats(): void {
  try {
    // Obtener estadísticas actuales del localStorage
    const currentStats = getLocalStats();
    
    // Incrementar contadores relevantes
    const updatedStats: LocalStats = {
      ...currentStats,
      total_orders: currentStats.total_orders + 1,
      recent_orders: currentStats.recent_orders + 1,
      pending_orders: currentStats.pending_orders + 1,
    };

    // Guardar estadísticas actualizadas
    saveLocalStats(updatedStats);
    
    // Disparar evento personalizado para notificar a otros componentes
    window.dispatchEvent(new CustomEvent('statsUpdated', { 
      detail: { 
        type: 'order_created',
        stats: updatedStats 
      } 
    }));

    console.log('[StatsService] Estadísticas actualizadas:', updatedStats);
  } catch (error) {
    console.error('[StatsService] Error al actualizar estadísticas:', error);
  }
}

/**
 * Actualiza el contador de pedidos pendientes
 */
export function updatePendingOrdersStats(delta: number): void {
  try {
    const currentStats = getLocalStats();
    
    const updatedStats: LocalStats = {
      ...currentStats,
      pending_orders: Math.max(0, currentStats.pending_orders + delta),
    };

    saveLocalStats(updatedStats);
    
    window.dispatchEvent(new CustomEvent('statsUpdated', { 
      detail: { 
        type: 'pending_orders_updated',
        stats: updatedStats 
      } 
    }));

    console.log('[StatsService] Pedidos pendientes actualizados:', updatedStats.pending_orders);
  } catch (error) {
    console.error('[StatsService] Error al actualizar pedidos pendientes:', error);
  }
}

/**
 * Obtiene las estadísticas locales
 */
function getLocalStats(): LocalStats {
  try {
    const stored = localStorage.getItem('tecnogafas_stats');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[StatsService] Error al obtener estadísticas locales:', error);
  }

  // Valores por defecto si no hay datos guardados
  return {
    total_orders: 0,
    total_clients: 0,
    total_products: 0,
    total_sellers: 0,
    recent_orders: 0,
    pending_orders: 0,
    pedidos_ultimas_24h: 0,
    items_ultimas_24h: 0,
    pedidos_mes_actual: 0,
    items_mes_actual: 0,
    productos_mas_pedidos_24h: [],
    productos_mas_pedidos_mes: [],
  };
}

/**
 * Guarda las estadísticas en localStorage
 */
function saveLocalStats(stats: LocalStats): void {
  try {
    localStorage.setItem('tecnogafas_stats', JSON.stringify(stats));
  } catch (error) {
    console.error('[StatsService] Error al guardar estadísticas:', error);
  }
}

/**
 * Sincroniza las estadísticas locales con el servidor
 */
export async function syncStatsWithServer(): Promise<void> {
  try {
    // Importar dinámicamente para evitar dependencias circulares
    const { apiService } = await import('./apiService');
    
    const serverStats = await apiService.getStats();
    if (serverStats.success) {
      const localStats: LocalStats = {
        total_orders: serverStats.data.total_pedidos || 0,
        total_clients: serverStats.data.total_clientes || 0,
        total_products: serverStats.data.total_productos || 0,
        total_sellers: serverStats.data.total_usuarios || 0,
        recent_orders: serverStats.data.pedidos_ultimas_24h || 0,
        pending_orders: 0,
        pedidos_ultimas_24h: serverStats.data.pedidos_ultimas_24h || 0,
        items_ultimas_24h: serverStats.data.items_ultimas_24h || 0,
        pedidos_mes_actual: serverStats.data.pedidos_mes_actual || 0,
        items_mes_actual: serverStats.data.items_mes_actual || 0,
        productos_mas_pedidos_24h: serverStats.data.productos_mas_pedidos_24h || [],
        productos_mas_pedidos_mes: serverStats.data.productos_mas_pedidos_mes || [],
      };

      saveLocalStats(localStats);
      
      window.dispatchEvent(new CustomEvent('statsUpdated', { 
        detail: { 
          type: 'synced_with_server',
          stats: localStats 
        } 
      }));

      console.log('[StatsService] Estadísticas sincronizadas con el servidor');
    }
  } catch (error) {
    console.error('[StatsService] Error al sincronizar estadísticas:', error);
  }
}

/**
 * Hook personalizado para escuchar actualizaciones de estadísticas
 */
export function useStatsUpdates(callback: (detail: { type: string; stats: LocalStats }) => void): () => void {
  const handleStatsUpdate = (event: CustomEvent) => {
    callback(event.detail);
  };

  window.addEventListener('statsUpdated', handleStatsUpdate as EventListener);

  // Función de limpieza
  return () => {
    window.removeEventListener('statsUpdated', handleStatsUpdate as EventListener);
  };
}
