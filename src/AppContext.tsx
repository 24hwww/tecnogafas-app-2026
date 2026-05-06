import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { appDB } from './stores/appDatabase';
import { Product, Client, Seller } from './types';
import { useDataSync } from './hooks/context/useDataSync';
import { useCacheManager } from './hooks/context/useCacheManager';
import { syncAllPendingOrders, getPendingOrders } from './services/pendingOrdersSync';
import { useAuth } from './contexts/AuthContext';
import { useConnection } from './contexts/ConnectionContext';
import { useOrders } from './contexts/OrdersContext';

interface AppContextType {
  products: Product[];
  clients: Client[];
  sellers: Seller[];
  isLoading: boolean;
  apiError: string | null;
  appVersionInfo: any | null;
  hasNewVersion: boolean;
  currentAppVersion: string | null;
  setApiError: (error: string | null) => void;
  refreshData: (showLoading?: boolean) => Promise<void>;
  forceRefresh: () => Promise<void>;
  clearAllCaches: () => Promise<void>;
  syncPendingOrders: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { globalPin } = useAuth();
  const { isOnline, setConnectionStatus } = useConnection();
  const { setOrders, setTotalOrders, setGrandTotalOrders, setDashboardOrders, setPendingOrdersCount } = useOrders();

  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [appVersionInfo, setAppVersionInfo] = useState<any | null>(null);
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [currentAppVersion, setCurrentAppVersion] = useState<string | null>(null);

  const { refreshData } = useDataSync(
    globalPin, setProducts, setClients, setOrders, setTotalOrders, setGrandTotalOrders, 
    setDashboardOrders, setSellers, setAppVersionInfo, setCurrentAppVersion, setHasNewVersion, setIsLoading,
    setConnectionStatus
  );

  const { forceRefresh: forceRefreshBase, clearAllCaches } = useCacheManager(refreshData);

  const forceRefresh = useCallback(async () => {
    await forceRefreshBase(setIsLoading);
  }, [forceRefreshBase]);

  const syncPendingOrders = useCallback(async () => {
    if (!isOnline || !globalPin) return;
    
    console.log('🔄 Checking for pending orders to sync...');
    try {
      setConnectionStatus('syncing');
      const result = await syncAllPendingOrders(globalPin);
      
      if (result.total > 0) {
        console.log(`✅ Synced ${result.success} orders, ${result.failed} failed`);
        if (result.success > 0) {
          await refreshData();
        }
      }
      
      const pending = await getPendingOrders(globalPin, ['pending', 'failed']);
      setPendingOrdersCount(pending.length);
      
      setConnectionStatus('online');
    } catch (err) {
      console.error('Error syncing pending orders:', err);
      setConnectionStatus('error');
    }
  }, [isOnline, globalPin, refreshData, setConnectionStatus, setPendingOrdersCount]);

  useEffect(() => {
    const loadCachedAndRefresh = async () => {
      let hasCache = false;
      try {
        const cachedProducts = await appDB.products.toArray();
        const cachedClients = await appDB.clients.toArray();
        const cachedSellers = await appDB.sellers.toArray();

        if (cachedProducts.length > 0) { setProducts(cachedProducts); hasCache = true; }
        if (cachedClients.length > 0) { setClients(cachedClients); hasCache = true; }
        if (cachedSellers.length > 0) { setSellers(cachedSellers); hasCache = true; }
      } catch (e) {
        console.error('Error reading cache', e);
      }

      if (hasCache) {
        setIsLoading(false);
      }

      await refreshData(false);
      setIsLoading(false);
    };

    loadCachedAndRefresh();
  }, [refreshData]);

  // Handle online recovery sync
  useEffect(() => {
    const handleOnline = () => {
      if (globalPin) {
        syncPendingOrders();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [globalPin, syncPendingOrders]);

  return (
    <AppContext.Provider value={{
      products, clients, sellers, isLoading, apiError, appVersionInfo, hasNewVersion, currentAppVersion,
      setApiError, refreshData, forceRefresh, clearAllCaches, syncPendingOrders
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
