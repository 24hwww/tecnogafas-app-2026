import { useCallback } from 'react';
import { apiService } from '../../services/apiService';
import { set } from 'idb-keyval';
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
  setIsLoading: (l: boolean) => void
) {
  const refreshData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [p, c, o, s] = await Promise.all([
        apiService.getProducts(),
        apiService.getClients(),
        apiService.getOrders(1, 25, undefined),
        apiService.getSellers(),
      ]);

      // Sort orders by createdAt (post_date) descending - most recent first
      const sortedOrders = [...o.orders].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setProducts(p);
      setClients(c);
      setOrders(sortedOrders);
      setTotalOrders(o.total);
      setGrandTotalOrders(o.total);
      setDashboardOrders(sortedOrders.slice(0, 5));
      setSellers(s);


      try {
        await set('tecnogafas_products', p);
        await set('tecnogafas_clients', c);
        const cachedOrders = sortedOrders.map(({ rawData, ...rest }: any) => rest);
        await set('tecnogafas_orders', cachedOrders);
        await set('tecnogafas_sellers', s);
      } catch (cacheError) {
        console.warn('Failed to save to local storage cache', cacheError);
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [globalPin, setProducts, setClients, setOrders, setTotalOrders, setGrandTotalOrders, setDashboardOrders, setSellers, setAppVersionInfo, setCurrentAppVersion, setHasNewVersion, setIsLoading]);

  return { refreshData };
}
