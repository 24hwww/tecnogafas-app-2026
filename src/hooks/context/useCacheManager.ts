import { useCallback } from 'react';
import { appDB } from '../../stores/appDatabase';

export function useCacheManager(refreshData: (showLoading?: boolean) => Promise<void>) {
  const forceRefresh = useCallback(async (setIsLoading: (l: boolean) => void) => {
    setIsLoading(true);
    try {
      await Promise.all([
        appDB.products.clear(),
        appDB.clients.clear(),
        appDB.orders.clear(),
        appDB.sellers.clear()
      ]);
      await refreshData(false);
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
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
      // 1. Limpiar IndexedDB (Dexie)
      await Promise.all([
        appDB.products.clear(),
        appDB.clients.clear(),
        appDB.orders.clear(),
        appDB.sellers.clear(),
        appDB.drafts.clear(),
        appDB.sharedCarts.clear(),
        appDB.cart.clear(),
        appDB.selectedClient.clear()
      ]);

      // 2. Limpiar TODO el localStorage de la app
      localStorage.clear();

      // 3. Limpiar sessionStorage
      sessionStorage.clear();

      // 4. Limpiar cachés del service worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ALL_CACHES' });
      }

      // 5. Limpiar todas las bases de datos de IndexedDB externas
      await indexedDB.deleteDatabase('tecnogafas-sync');
      await indexedDB.deleteDatabase('keyval-store'); // Para asegurar que no queden datos antiguos de idb-keyval

      // 6. Limpiar Cache API del navegador
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // 7. Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }

      // No recargar la página, dejar que refreshData() maneje la sincronización
      // window.location.reload();
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }, []);

  return { forceRefresh, clearAllCaches };
}
