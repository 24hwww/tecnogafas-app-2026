import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { get, set, del } from 'idb-keyval';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Product, Client, Order, CartItem, DraftOrder, Seller } from './types';
import { apiService } from './services/apiService';
import { useNotifications } from './hooks/context/useNotifications';
import { useDataSync } from './hooks/context/useDataSync';
import { useCacheManager } from './hooks/context/useCacheManager';

interface AppContextType {
  products: Product[];
  clients: Client[];
  orders: Order[];
  totalOrders: number;
  grandTotalOrders: number;
  dashboardOrders: Order[];
  sellers: Seller[];
  cart: CartItem[];
  drafts: DraftOrder[];
  isLoading: boolean;
  selectedClient: Client | null;
  currentDraftId: string | null;
  setSelectedClient: (client: Client | null) => void;
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  saveDraft: (details: any) => void;
  loadDraft: (draftId: string) => void;
  markDraftAsSent: (draftId: string) => void;
  primaryColor: string;
  fontSize: string;
  globalPin: string | null;
  currentSeller: Seller | null;
  apiError: string | null;
  onlineUsersCount: number | null;
  deployEvent: any | null;
  appVersionInfo: any | null;
  notifications: any[];
  unreadNotifications: number;
  theme: 'light' | 'dark';
  setNotifications: (notifications: any[]) => void;
  setPrimaryColor: (color: string) => void;
  setFontSize: (size: string) => void;
  setGlobalPin: (pin: string | null) => void;
  setApiError: (error: string | null) => void;
  setOnlineUsersCount: (count: number | null) => void;
  setTotalOrders: (total: number) => void;
  isOnline: boolean;
  connectionStatus: 'online' | 'offline' | 'syncing' | 'error';
  setDeployNotification: (event: any) => void;
  setUnreadNotifications: (count: number) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  fetchNotifications: () => Promise<void>;
  sendNotification: (toUserId: number, content: string, type?: 'message' | 'notification') => Promise<boolean>;
  markAllNotificationsAsRead: () => Promise<void>;
  markNotificationAsShown: (id: number) => void;
  hasNotificationBeenShown: (id: number) => boolean;
  fetchOrders: (page: number, perPage: number, sellerId?: number, customerId?: number) => Promise<void>;
  refreshData: (showLoading?: boolean) => Promise<void>;
  forceRefresh: () => Promise<void>;
  initializePushNotifications: () => Promise<void>;
  clearAllCaches: () => Promise<void>;
  hasNewVersion: boolean;
  currentAppVersion: string | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [grandTotalOrders, setGrandTotalOrders] = useState(0);
  const [dashboardOrders, setDashboardOrders] = useState<Order[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [drafts, setDrafts] = useState<DraftOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#0A5DFF');
  const [fontSize, setFontSize] = useState('16px');
  const [globalPin, setGlobalPin] = useState<string | null>(null);
  const [currentSeller, setCurrentSeller] = useState<Seller | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [onlineUsersCount, setOnlineUsersCount] = useState<number | null>(null);
  const [deployEvent, setDeployEvent] = useState<any | null>(null);
  const [appVersionInfo, setAppVersionInfo] = useState<any | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [currentAppVersion, setCurrentAppVersion] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'syncing' | 'error'>('online');
  const [shownNotificationIds, setShownNotificationIds] = useState<Set<number>>(new Set());

  const { fetchNotifications, sendNotification: sendNotificationBase } = useNotifications(globalPin, currentSeller, setNotifications, setUnreadNotifications);
  
  const { refreshData } = useDataSync(
    globalPin, setProducts, setClients, setOrders, setTotalOrders, setGrandTotalOrders, 
    setDashboardOrders, setSellers, setAppVersionInfo, setCurrentAppVersion, setHasNewVersion, setIsLoading,
    setConnectionStatus
  );

  const { forceRefresh: forceRefreshBase, clearAllCaches } = useCacheManager(refreshData);

  const forceRefresh = useCallback(async () => {
      await forceRefreshBase(setIsLoading);
  }, [forceRefreshBase]);

  const sendNotification = useCallback(async (toUserId: number, content: string, type: 'message' | 'notification' = 'notification') => {
    return sendNotificationBase(toUserId, content, type, currentSeller?.id, currentSeller?.name);
  }, [sendNotificationBase, currentSeller]);

  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(async () => {
    if (!globalPin || !currentSeller || notifications.length === 0) return;
    
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;
    
    // Mark each as read in parallel
    await Promise.all(
      unreadNotifications.map(n => 
        apiService.ackEvent(n.id, globalPin).catch(() => null)
      )
    );
    
    // Refresh notifications to get updated read status
    await fetchNotifications();
  }, [globalPin, currentSeller, notifications, fetchNotifications]);

  const MAX_SHOWN_NOTIFICATIONS = 100; // Limitar para evitar memory leak

  // Track shown notification IDs to prevent duplicates (FIFO - solo mantiene últimos 100)
  const markNotificationAsShown = useCallback((id: number) => {
    setShownNotificationIds(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      // Si excede el límite, eliminar los más antiguos (FIFO)
      if (newSet.size > MAX_SHOWN_NOTIFICATIONS) {
        const iterator = newSet.values();
        const toDelete = [];
        for (let i = 0; i < newSet.size - MAX_SHOWN_NOTIFICATIONS; i++) {
          const value = iterator.next().value;
          if (value !== undefined) toDelete.push(value);
        }
        toDelete.forEach(v => newSet.delete(v));
      }
      return newSet;
    });
  }, []);

  const hasNotificationBeenShown = useCallback((id: number) => {
    return shownNotificationIds.has(id);
  }, [shownNotificationIds]);

  const initializePushNotifications = useCallback(async () => {
    if (Capacitor.getPlatform() === 'web') return;

    try {
      await LocalNotifications.requestPermissions();
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive !== 'granted') return;

      await PushNotifications.register();
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const eventId = notification?.data?.event_id || notification?.data?.id;
        
        // Check if this notification was already shown locally
        if (eventId && hasNotificationBeenShown(eventId)) {
          console.log('🔕 Push notification already shown, skipping:', eventId);
          return;
        }
        
        // Mark as shown to prevent duplicates
        if (eventId) {
          markNotificationAsShown(eventId);
        }
        
        setUnreadNotifications(prev => prev + 1);
        fetchNotifications();
      });
    } catch (e) {
      console.error('Error initializing Push Notifications', e);
    }
  }, [fetchNotifications, hasNotificationBeenShown, markNotificationAsShown]);

  const syncAll = useCallback(async () => {
    console.log('🔄 Performing global sync via SSE trigger...');
    await Promise.all([
      fetchNotifications(),
      apiService.getOrders(1, 10, globalPin || undefined).then(o => {
        setOrders(o.orders);
        setTotalOrders(o.total);
      }),
      apiService.getProducts().then(setProducts)
    ]);
  }, [fetchNotifications, globalPin]);

  const setDeployNotification = (event: any) => {
      setDeployEvent(event);
      setTimeout(() => setDeployEvent(null), 10000);
  }

  const fetchOrders = async (page: number = 1, perPage: number = 25, sellerId?: number, customerId?: number) => {
    setIsLoading(true);
    try {
      const o = await apiService.getOrders(page, perPage, sellerId, customerId);
      setOrders(o.orders);
      setTotalOrders(o.total);
    } catch (error) {
      console.error('Failed to fetch orders', error);
      setApiError('No se pudieron cargar los pedidos');
    } finally {
      setIsLoading(false);
    }
  };

  const updatePrimaryColor = (color: string) => {
    setPrimaryColor(color);
    localStorage.setItem('tecnogafas_primaryColor', color);
  };

  const updateFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem('tecnogafas_fontSize', size);
  };

  // Detectar tema según hora de Buenos Aires (UTC-3)
  // Light: 6:00 - 18:00, Dark: 18:00 - 6:00
  const detectBuenosAiresTheme = useCallback(() => {
    const now = new Date();
    // Obtener hora de Buenos Aires (UTC-3)
    const buenosAiresTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const hour = buenosAiresTime.getHours();
    return hour >= 6 && hour < 18 ? 'light' : 'dark';
  }, []);

  const updateTheme = useCallback((newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('tecnogafas_theme', newTheme);
  }, []);

  const updateGlobalPin = (pin: string | null) => {
    setGlobalPin(pin);
    if (pin) {
      localStorage.setItem('tecnogafas_pin', pin);
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'START_POLLING', pin: pin });
        navigator.serviceWorker.controller.postMessage({ type: 'APP_ACTIVE' });
      }
    } else {
      localStorage.removeItem('tecnogafas_pin');
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'STOP_POLLING' });
      }
    }
  };

  // Remaining useEffect logic for SSE and initialization
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionStatus('online');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('offline');
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller && globalPin) {
          navigator.serviceWorker.controller.postMessage({ type: 'APP_INACTIVE', pin: globalPin });
        }
      } else {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'APP_ACTIVE' });
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const savedPin = localStorage.getItem('tecnogafas_pin');
    if (savedPin) {
      setGlobalPin(savedPin);
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'START_POLLING', pin: savedPin });
      }
    }

    initializePushNotifications();

    const loadCachedAndRefresh = async () => {
      let hasCache = false;
      try {
        const cachedProducts = await get<Product[]>('tecnogafas_products');
        const cachedClients = await get<Client[]>('tecnogafas_clients');
        const cachedOrdersData = await get<Order[]>('tecnogafas_orders');
        const cachedSellers = await get<Seller[]>('tecnogafas_sellers');
        const cachedDrafts = await get<DraftOrder[]>('tecnogafas_drafts');

        if (cachedProducts) { setProducts(cachedProducts); hasCache = true; }
        if (cachedClients) { setClients(cachedClients); hasCache = true; }
        if (cachedDrafts) { setDrafts(cachedDrafts); }
        if (cachedOrdersData) { 
          setOrders(cachedOrdersData); 
          setTotalOrders(cachedOrdersData.length); 
          setGrandTotalOrders(cachedOrdersData.length);
          setDashboardOrders(cachedOrdersData.slice(0, 5));
          hasCache = true; 
        }
        if (cachedSellers) { setSellers(cachedSellers); hasCache = true; }
      } catch (e) {
        console.error('Error reading cache', e);
      }

      if (hasCache) {
        setIsLoading(false);
      }
      
      const savedPrimaryColor = localStorage.getItem('tecnogafas_primaryColor');
      if (savedPrimaryColor) setPrimaryColor(savedPrimaryColor);
      const savedFontSize = localStorage.getItem('tecnogafas_fontSize');
      if (savedFontSize) setFontSize(savedFontSize);

      // Inicializar tema: usar localStorage si existe, o detectar según hora Buenos Aires
      const savedTheme = localStorage.getItem('tecnogafas_theme') as 'light' | 'dark' | null;
      if (savedTheme) {
        updateTheme(savedTheme);
      } else {
        const autoTheme = detectBuenosAiresTheme();
        updateTheme(autoTheme);
      }

      await refreshData(!hasCache);
    };

    loadCachedAndRefresh();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [initializePushNotifications, globalPin, updateTheme, detectBuenosAiresTheme]);

  useEffect(() => {
    if (globalPin && isOnline) {
      apiService.getUnreadCount(globalPin).then(setUnreadNotifications);
      fetchNotifications();
    }
  }, [globalPin, isOnline, fetchNotifications]);

  // Efecto para actualizar tema automáticamente cada minuto según hora Buenos Aires
  useEffect(() => {
    const checkTheme = () => {
      const autoTheme = detectBuenosAiresTheme();
      const currentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
      if (autoTheme !== currentTheme) {
        updateTheme(autoTheme);
      }
    };

    // Verificar inmediatamente y luego cada minuto
    checkTheme();
    const interval = setInterval(checkTheme, 60000);

    return () => clearInterval(interval);
  }, [detectBuenosAiresTheme, updateTheme]);

  const addToCart = (product: Product, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(item => item.id !== productId));
  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) { removeFromCart(productId); return; }
    setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity } : item));
  };

  const clearCart = () => { setCart([]); setSelectedClient(null); setCurrentDraftId(null); };

  const saveDraft = async (details: any) => {
    if (!selectedClient || cart.length === 0) return;
    let updatedDrafts: DraftOrder[];
    if (currentDraftId) {
      updatedDrafts = drafts.map(d => d.id === currentDraftId ? { ...d, client: selectedClient, items: [...cart], details, date: new Date().toISOString() } : d);
    } else {
      updatedDrafts = [...drafts, { id: `draft_${Date.now()}`, client: selectedClient, items: [...cart], details, status: 'no enviado', date: new Date().toISOString() }];
    }
    setDrafts(updatedDrafts);
    await set('tecnogafas_drafts', updatedDrafts);
    clearCart();
  };

  const loadDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (draft) { setCart(draft.items); setSelectedClient(draft.client); setCurrentDraftId(draft.id); }
  };

  const markDraftAsSent = async (draftId: string) => {
    const updatedDrafts = drafts.map(d => d.id === draftId ? { ...d, status: 'enviado' as const } : d);
    setDrafts(updatedDrafts);
    await set('tecnogafas_drafts', updatedDrafts);
  };

  // SSE desactivado temporalmente por problemas de conexión
  useEffect(() => {
    console.log('🔕 SSE desactivado');
    return;
    // Código SSE comentado temporalmente:
    /*
    let eventSource: EventSource | null = null;
    console.log("DEBUG: globalPin en SSE init:", globalPin);

    if (globalPin && isOnline) {
      apiService.loginSeller(globalPin).then(seller => {
        if (seller) {
          setCurrentSeller(seller);
          const lastId = localStorage.getItem('tecnogafas_last_event_id') || '';
          const url = new URL('https://api.tecnogafas.com.ar/events/stream');
          if (lastId) url.searchParams.set('last_id', lastId);
          
          // Crear EventSource con headers personalizados usando fetch API
          const connectSSE = () => {
            const headers: Record<string, string> = {};
            if (seller?.id) {
              headers['Authorization'] = `Bearer ${seller.id}`;
            }
            if (lastId) {
              headers['Last-Event-ID'] = lastId;
            }
            
            // Usar EventSource nativo (no soporta headers custom)
            // Pero enviamos seller_id como query param para filtrado server-side
            url.searchParams.set('seller_id', seller.id);
            
            eventSource = new EventSource(url.toString());
            
            eventSource.onopen = () => {
              console.log('✅ SSE connected');
              syncAll();
            };
            
            eventSource.onmessage = (event) => {
               if (event.lastEventId) {
                 localStorage.setItem('tecnogafas_last_event_id', event.lastEventId);
               }
               try {
                  const data = JSON.parse(event.data);
                  const eventType = data.type || event.type;
                  
                  // Server now filters by user_id, no need for client-side filtering
                  if (eventType === 'order' || eventType === 'sync') {
                    syncAll();
                  }
                  if (eventType === 'notification' || eventType === 'message') {
                    const eventId = data.id;
                    // Skip if already shown (deduplication)
                    if (eventId && hasNotificationBeenShown(eventId)) {
                      console.log('🔕 SSE event already shown, skipping:', eventId);
                    } else {
                      if (eventId) markNotificationAsShown(eventId);
                      setUnreadNotifications(prev => prev + 1);
                      // Delay fetch to batch multiple rapid events
                      setTimeout(fetchNotifications, 300);
                    }
                  }
               } catch (e) {
                 console.error('Error parsing SSE data:', e);
               }
            };
            
            eventSource.onerror = (err) => {
              console.error('❌ SSE error:', err);
              // Reconectar con backoff exponencial
              setTimeout(() => {
                if (globalPin && isOnline) {
                  connectSSE();
                }
              }, 5000);
            };
          };
          
          connectSSE();
        }
      });
    }
    return () => {
      eventSource?.close();
    };
    */
  }, [globalPin, isOnline, syncAll, fetchNotifications, hasNotificationBeenShown, markNotificationAsShown]);

  return (
    <AppContext.Provider value={{
      products, clients, orders, totalOrders, grandTotalOrders, dashboardOrders, sellers, cart, drafts, isLoading, selectedClient, currentDraftId, primaryColor, fontSize, globalPin, currentSeller, apiError, onlineUsersCount, deployEvent, appVersionInfo, notifications, unreadNotifications, theme, isOnline, connectionStatus, setNotifications, setSelectedClient,
      addToCart, removeFromCart, updateCartQuantity, clearCart, saveDraft, loadDraft, markDraftAsSent, setPrimaryColor: updatePrimaryColor, setFontSize: updateFontSize, setGlobalPin: updateGlobalPin, setApiError, setOnlineUsersCount, setTotalOrders, setDeployNotification, setUnreadNotifications, setTheme: updateTheme, fetchNotifications, sendNotification, fetchOrders, refreshData, forceRefresh, initializePushNotifications, clearAllCaches, hasNewVersion, currentAppVersion,
      markAllNotificationsAsRead, markNotificationAsShown, hasNotificationBeenShown
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
