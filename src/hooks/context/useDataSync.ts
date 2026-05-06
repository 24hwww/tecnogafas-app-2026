import { useCallback } from 'react';
import { apiService } from '../../services/apiService';
import { appDB } from '../../stores/appDatabase';
import { Product, Client, Order, Seller } from '../../types';

export function useDataSync(
  globalPin: string | null,
  setProducts: (p: Product[]) => void,
  setClients: (c: Client[]) => void,
  setOrders: (o: Order[]) => void,
  setTotalOrders: (t: number) => void,
  setGrandTotalOrders: (t: number) => void,
  setDashboardOrders: (o: Order[]) => void,
  setSellers: (s: Seller[]) => void,
  setAppVersionInfo: (v: any) => void,
  setCurrentAppVersion: (v: string | null) => void,
  setHasNewVersion: (h: boolean) => void,
  setIsLoading: (l: boolean) => void,
  setConnectionStatus?: (status: 'online' | 'offline' | 'syncing' | 'error') => void
) {
  const refreshData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setConnectionStatus?.('syncing');
    
    try {
      const results = await Promise.allSettled([
        apiService.getProducts(),
        apiService.getClients(),
        apiService.getOrders(1, 25, undefined),
        apiService.getSellers(),
        apiService.getStats(),
      ]);

      const [pRes, cRes, oRes, sRes, statsRes] = results;
      let hasErrors = false;

      // 1. Productos
      if (pRes.status === 'fulfilled') {
        setProducts(pRes.value);
        appDB.products.clear().then(() => appDB.products.bulkAdd(pRes.value)).catch(console.warn);
      } else {
        hasErrors = true;
        console.error('Error fetching products:', pRes.reason);
        try {
          const cached = await appDB.products.toArray();
          if (cached.length > 0) setProducts(cached);
        } catch(e) { console.error('Cache error products:', e); }
      }

      // 2. Clientes
      if (cRes.status === 'fulfilled') {
        setClients(cRes.value);
        appDB.clients.clear().then(() => appDB.clients.bulkAdd(cRes.value)).catch(console.warn);
      } else {
        hasErrors = true;
        console.error('Error fetching clients:', cRes.reason);
        try {
          const cached = await appDB.clients.toArray();
          if (cached.length > 0) setClients(cached);
        } catch(e) { console.error('Cache error clients:', e); }
      }

      // 3. Pedidos
      let ordersCountFallback = 0;
      if (oRes.status === 'fulfilled') {
        const sortedOrders = [...oRes.value.orders].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setOrders(sortedOrders);
        setTotalOrders(oRes.value.total);
        ordersCountFallback = oRes.value.total;
        setDashboardOrders(sortedOrders.slice(0, 5));
        
        const cachedOrders = sortedOrders.map(({ rawData, ...rest }: any) => rest);
        appDB.orders.clear().then(() => appDB.orders.bulkAdd(cachedOrders)).catch(console.warn);
      } else {
        hasErrors = true;
        console.error('Error fetching orders:', oRes.reason);
        try {
          const cached = await appDB.orders.toArray();
          if (cached.length > 0) {
            setOrders(cached);
            setTotalOrders(cached.length);
            ordersCountFallback = cached.length;
            setDashboardOrders(cached.slice(0, 5));
          }
        } catch(e) { console.error('Cache error orders:', e); }
      }

      // 4. Vendedores
      if (sRes.status === 'fulfilled') {
        setSellers(sRes.value);
        appDB.sellers.clear().then(() => appDB.sellers.bulkAdd(sRes.value)).catch(console.warn);
      } else {
        hasErrors = true;
        console.error('Error fetching sellers:', sRes.reason);
        try {
          const cached = await appDB.sellers.toArray();
          if (cached.length > 0) setSellers(cached);
        } catch(e) { console.error('Cache error sellers:', e); }
      }

      // 5. Estadísticas
      if (statsRes.status === 'fulfilled') {
        setGrandTotalOrders(statsRes.value.data.total_orders);
      } else {
        hasErrors = true;
        console.error('Error fetching stats:', statsRes.reason);
        setGrandTotalOrders(ordersCountFallback);
      }

      setConnectionStatus?.(hasErrors ? 'error' : 'online');
    } catch (error) {
      console.error('Fatal error during sync process:', error);
      setConnectionStatus?.('error');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [globalPin, setProducts, setClients, setOrders, setTotalOrders, setGrandTotalOrders, setDashboardOrders, setSellers, setAppVersionInfo, setCurrentAppVersion, setHasNewVersion, setIsLoading, setConnectionStatus]);

  return { refreshData };
}
