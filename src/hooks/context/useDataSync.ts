import { useCallback } from 'react';
import { apiService } from '../../services/apiService';
import { appDB } from '../../stores/appDatabase';
import type { Client, Order, Product, Seller } from '../../types';

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
  setConnectionStatus?: (status: 'online' | 'offline' | 'syncing' | 'error') => void,
) {
  const refreshData = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      setConnectionStatus?.('syncing');

      try {
        const results = await Promise.allSettled([
          apiService.getProducts(),
          apiService.getClients(),
          apiService.getOrders(1, 25, globalPin || undefined),
          apiService.getStats(),
        ]);

        const [pRes, cRes, oRes, statsRes] = results;
        let hasErrors = false;

        // 1. Productos
        if (pRes.status === 'fulfilled') {
          setProducts(pRes.value);
          appDB.products
            .clear()
            .then(() => appDB.products.bulkAdd(pRes.value))
            .catch(console.warn);
        } else {
          hasErrors = true;
          console.error('Error fetching products:', pRes.reason);
          try {
            const cached = await appDB.products.toArray();
            if (cached.length > 0) setProducts(cached);
          } catch (e) {
            console.error('Cache error products:', e);
          }
        }

        // 2. Clientes
        if (cRes.status === 'fulfilled') {
          setClients(cRes.value);
          appDB.clients
            .clear()
            .then(() => appDB.clients.bulkAdd(cRes.value))
            .catch(console.warn);
        } else {
          hasErrors = true;
          console.error('Error fetching clients:', cRes.reason);
          try {
            const cached = await appDB.clients.toArray();
            if (cached.length > 0) setClients(cached);
          } catch (e) {
            console.error('Cache error clients:', e);
          }
        }

        // 3. Pedidos & Vendedores
        let ordersCountFallback = 0;
        if (oRes.status === 'fulfilled') {
          const sortedOrders = [...oRes.value.orders].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          setOrders(sortedOrders);
          setTotalOrders(oRes.value.total);
          ordersCountFallback = oRes.value.total;
          setDashboardOrders(sortedOrders.slice(0, 5));

          // Extraer vendedores de los pedidos
          const uniqueSellersMap = new Map<string, string>();
          sortedOrders.forEach((o: Order) => {
            if (o.sellerId && o.sellerName) {
              uniqueSellersMap.set(o.sellerId, o.sellerName);
            }
          });
          const extractedSellers: Seller[] = Array.from(uniqueSellersMap.entries()).map(
            ([id, name]) => ({ id, name }),
          );
          setSellers(extractedSellers);
          appDB.sellers
            .clear()
            .then(() => appDB.sellers.bulkAdd(extractedSellers))
            .catch(console.warn);

          const cachedOrders = sortedOrders.map(({ rawData, ...rest }: any) => rest);
          appDB.orders
            .clear()
            .then(() => appDB.orders.bulkAdd(cachedOrders))
            .catch(console.warn);
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

              // Extraer vendedores de la caché de pedidos
              const uniqueSellersMap = new Map<string, string>();
              cached.forEach((o: Order) => {
                if (o.sellerId && o.sellerName) {
                  uniqueSellersMap.set(o.sellerId, o.sellerName);
                }
              });
              const extractedSellers: Seller[] = Array.from(uniqueSellersMap.entries()).map(
                ([id, name]) => ({ id, name }),
              );
              if (extractedSellers.length > 0) {
                setSellers(extractedSellers);
              } else {
                const cachedSellers = await appDB.sellers.toArray();
                if (cachedSellers.length > 0) setSellers(cachedSellers);
              }
            }
          } catch (e) {
            console.error('Cache error orders:', e);
          }
        }

        // 5. Estadísticas
        if (statsRes.status === 'fulfilled') {
          setGrandTotalOrders(statsRes.value.data.total_orders);
        } else {
          // No marcamos hasErrors para estadísticas ya que es secundario
          console.warn('Stats endpoint not available (404), using fallback');
          setGrandTotalOrders(ordersCountFallback);
        }

        setConnectionStatus?.(hasErrors ? 'error' : 'online');
      } catch (error) {
        console.error('Fatal error during sync process:', error);
        setConnectionStatus?.('error');
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [
      globalPin,
      setProducts,
      setClients,
      setOrders,
      setTotalOrders,
      setGrandTotalOrders,
      setDashboardOrders,
      setSellers,
      setAppVersionInfo,
      setCurrentAppVersion,
      setHasNewVersion,
      setIsLoading,
      setConnectionStatus,
    ],
  );

  return { refreshData };
}
