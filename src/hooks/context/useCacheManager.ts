import { useCallback } from 'react';
import { del } from 'idb-keyval';

export function useCacheManager(refreshData: (showLoading?: boolean) => Promise<void>) {
  const forceRefresh = useCallback(async (setIsLoading: (l: boolean) => void) => {
    setIsLoading(true);
    try {
      const keysToClear = [
        'tecnogafas_products', 
        'tecnogafas_clients', 
        'tecnogafas_orders', 
        'tecnogafas_sellers'
      ];
      await Promise.all(keysToClear.map(key => del(key)));
      await refreshData(false);
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          registration.update();
        }
      }
    } catch (error) {
      console.error('Force refresh failed', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshData]);

  const clearAllCaches = useCallback(async () => {
    try {
      const keysToClear = [
        'tecnogafas_products', 
        'tecnogafas_clients', 
        'tecnogafas_orders', 
        'tecnogafas_sellers',
        'tecnogafas_drafts'
      ];
      await Promise.all(keysToClear.map(key => del(key)));
      
      localStorage.removeItem('tecnogafas_pin');
      localStorage.removeItem('tecnogafas_primaryColor');
      localStorage.removeItem('tecnogafas_fontSize');
      localStorage.removeItem('tecnogafas_last_event_id');
      
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ALL_CACHES' });
      }
      
      await indexedDB.deleteDatabase('tecnogafas-sync');
      window.location.reload();
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }, []);

  return { forceRefresh, clearAllCaches };
}
