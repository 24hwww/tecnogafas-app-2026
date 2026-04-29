import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { get, set, del } from 'idb-keyval';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Product, Client, Order, CartItem, DraftOrder, Seller } from './types';
import { apiService } from './services/apiService';

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
  setPrimaryColor: (color: string) => void;
  setFontSize: (size: string) => void;
  setGlobalPin: (pin: string | null) => void;
  setApiError: (error: string | null) => void;
  setOnlineUsersCount: (count: number | null) => void;
  setTotalOrders: (total: number) => void;
  setDeployNotification: (event: any) => void;
  setUnreadNotifications: (count: number) => void;
  fetchNotifications: () => Promise<void>;
  sendNotification: (toUserId: number, content: string, type?: 'message' | 'notification') => Promise<boolean>;
  fetchOrders: (page: number, perPage: number, sellerId?: number, customerId?: number) => Promise<void>;
  refreshData: (showLoading?: boolean) => Promise<void>;
  forceRefresh: () => Promise<void>;
  initializePushNotifications: () => Promise<void>;
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
  const [primaryColor, setPrimaryColor] = useState('#1662E1');
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
  const [retrySSE, setRetrySSE] = useState(0);
  const [retryDelay, setRetryDelay] = useState(5000);
  const [pushToken, setPushToken] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!globalPin) return;
    try {
      console.log('📡 Syncing notifications from server...');
      const data = await apiService.getEvents(undefined, globalPin);
      setNotifications(data);
      const unread = await apiService.getUnreadCount(globalPin);
      setUnreadNotifications(unread);
    } catch (e) {
      // apiService handlers already log warnings, here we just log for context in AppContext
      console.warn('Notification sync paused:', e instanceof Error ? e.message : String(e));
    }
  }, [globalPin]);

  const initializePushNotifications = useCallback(async () => {
    if (Capacitor.getPlatform() === 'web') {
      console.log('Push Notifications not supported on web natively via Capacitor, using fallback.');
      return;
    }

    try {
      await LocalNotifications.requestPermissions();
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('User denied push notification permissions');
        return;
      }

      await PushNotifications.register();

      // Listeners
      PushNotifications.addListener('registration', token => {
        console.log('Push registration success, token: ' + token.value);
        setPushToken(token.value);
        // Here you would normally send the token to your server
      });

      PushNotifications.addListener('registrationError', err => {
        console.error('Push registration error: ' + err.error);
      });

      PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('Push notification received: ', notification);
        setUnreadNotifications(prev => prev + 1);
        fetchNotifications();
      });

      PushNotifications.addListener('pushNotificationActionPerformed', action => {
        console.log('Push notification action performed', action);
      });
    } catch (e) {
      console.error('Error initializing Push Notifications', e);
    }
  }, [fetchNotifications]);

  const syncAll = useCallback(async () => {
    console.log('🔄 Performing global sync via SSE trigger...');
    await Promise.all([
      fetchNotifications(),
      // We also refresh orders and products to ensure everything is in sync
      apiService.getOrders(1, 10).then(o => {
        setOrders(o.orders);
        setTotalOrders(o.total);
      }),
      apiService.getProducts().then(setProducts)
    ]);
  }, [fetchNotifications]);

  const playNotificationSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log('Audio play failed', e));
  };

  const setDeployNotification = (event: any) => {
      setDeployEvent(event);
      setTimeout(() => setDeployEvent(null), 10000); // Autohide
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

  const sendNotification = async (toUserId: number, content: string, type: 'message' | 'notification' = 'notification') => {
    if (!globalPin) return false;
    try {
      await apiService.createEvent({
        user_id: toUserId,
        type,
        from_id: currentSeller?.id ? parseInt(currentSeller.id) : undefined,
        content: { 
          title: type === 'message' ? `Mensaje de ${currentSeller?.name || 'Vendedor'}` : 'Notificación de TecnoGafas',
          body: content 
        },
        read: 0
      }, globalPin);
      return true;
    } catch (e) {
      console.error('Error sending notification', e);
      return false;
    }
  };

  const forceRefresh = async () => {
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
        for(let registration of registrations) {
          registration.update();
        }
      }
    } catch (error) {
      console.error('Force refresh failed', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [p, c, o, s, appVer] = await Promise.all([
        apiService.getProducts(),
        apiService.getClients(),
        apiService.getOrders(1, 25), // Fetch first page
        apiService.getSellers(),
        apiService.getAppVersion(),
      ]);
      setProducts(p);
      setClients(c);
      setOrders(o.orders);
      setTotalOrders(o.total);
      setGrandTotalOrders(o.total);
      setDashboardOrders(o.orders.slice(0, 5));
      setSellers(s);
      if (appVer) setAppVersionInfo(appVer);

      // Save to cache
      try {
        await set('tecnogafas_products', p);
        await set('tecnogafas_clients', c);
        // Omit rawData from orders before saving to cache to prevent quota exceeded
        const cachedOrders = o.orders.map(({ rawData, ...rest }: any) => rest);
        await set('tecnogafas_orders', cachedOrders);
        await set('tecnogafas_sellers', s);
      } catch (cacheError) {
        console.warn('Failed to save to local storage cache (quota may be exceeded)', cacheError);
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [globalPin, fetchNotifications]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('En línea');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('Sin conexión');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const handleApiError = (e: any) => {
      const msg = e.detail?.message || 'Error de API';
      setApiError(msg);
      
      if ('Notification' in window && Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('Alerta de Conexión', {
              body: msg,
              icon: '/icon.png',
              badge: '/icon.png'
            });
          });
      }

      setTimeout(() => {
        setApiError(null);
      }, 5000);
    };

    window.addEventListener('api-error', handleApiError);

    const savedPin = localStorage.getItem('tecnogafas_pin');
    if (savedPin) {
      setGlobalPin(savedPin);
    }

    // Initialize Native Push Notifications
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

      // Refresh data in the background (or show loading if no cache)
      await refreshData(!hasCache);
    };

    loadCachedAndRefresh();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('api-error', handleApiError);
    };
  }, []);

  // Dedicated effect for notification syncing when PIN or online state changes
  useEffect(() => {
    if (globalPin && isOnline) {
      apiService.getUnreadCount(globalPin).then(setUnreadNotifications);
      fetchNotifications();
    }
  }, [globalPin, isOnline, fetchNotifications]);

  const addToCart = (product: Product, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id 
          ? { ...item, quantity: item.quantity + quantity }
          : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity } : item));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedClient(null);
    setCurrentDraftId(null);
  };

  const saveDraft = async (details: any) => {
    if (!selectedClient || cart.length === 0) return;
    
    let updatedDrafts: DraftOrder[];
    
    if (currentDraftId) {
      // Update existing draft
      updatedDrafts = drafts.map(d => d.id === currentDraftId ? {
        ...d,
        client: selectedClient,
        items: [...cart],
        details,
        date: new Date().toISOString()
      } : d);
    } else {
      // Create new draft
      const newDraft: DraftOrder = {
        id: `draft_${Date.now()}`,
        client: selectedClient,
        items: [...cart],
        details,
        status: 'no enviado',
        date: new Date().toISOString(),
      };
      updatedDrafts = [...drafts, newDraft];
    }

    setDrafts(updatedDrafts);
    await set('tecnogafas_drafts', updatedDrafts);
    clearCart();
  };

  const loadDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (draft) {
      setCart(draft.items);
      setSelectedClient(draft.client);
      setCurrentDraftId(draft.id);
    }
  };

  const markDraftAsSent = async (draftId: string) => {
    const updatedDrafts = drafts.map(d => d.id === draftId ? { ...d, status: 'enviado' as const } : d);
    setDrafts(updatedDrafts);
    await set('tecnogafas_drafts', updatedDrafts);
  };

  const updatePrimaryColor = (color: string) => {
    setPrimaryColor(color);
    localStorage.setItem('tecnogafas_primaryColor', color);
  };

  const updateFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem('tecnogafas_fontSize', size);
  };

  const updateGlobalPin = (pin: string | null) => {
    setGlobalPin(pin);
    if (pin) {
      localStorage.setItem('tecnogafas_pin', pin);
    } else {
      localStorage.removeItem('tecnogafas_pin');
    }
  };


  useEffect(() => {
    let eventSource: EventSource | null = null;
    
    if (globalPin && isOnline) {
      // Start SSE if pin is available and online
      apiService.loginSeller(globalPin).then(seller => {
         if (seller) {
            setCurrentSeller(seller);
            
            const lastId = localStorage.getItem('tecnogafas_last_event_id') || '';
            const url = new URL('https://api.tecnogafas.com.ar/events/stream');
            
            // Per USER instruction: only user_id is needed, which is the PIN
            url.searchParams.set('user_id', globalPin);
            if (lastId) {
              url.searchParams.set('last_id', lastId);
            }

            console.log(`🔌 Connecting SSE for PIN: ${globalPin}...`);
            const es = new EventSource(url.toString());
            eventSource = es;
 
            // 🔹 Handshake
            es.onopen = () => {
              console.log('✅ SSE Connection established');
              setRetryDelay(2000); // Reset backoff on success
              syncAll(); 
            };

            const handleSSEEvent = (event: MessageEvent) => {
              // Update last event ID if provided
              if (event.lastEventId) {
                localStorage.setItem('tecnogafas_last_event_id', event.lastEventId);
              }

              try {
                const data = JSON.parse(event.data);
                if (data.message === 'max runtime reached' || data.keepalive === true) return;
                
                console.log(`🔔 SSE Event [${event.type}]:`, data);

                // Determine effective type (some systems put type inside json, others in sse event field)
                const eventType = data.type || event.type;

                // Handle Presence updates
                if (eventType === 'presence' || data.onlineCount !== undefined || data.count !== undefined) {
                  setOnlineUsersCount(data.onlineCount ?? data.count);
                }

                // Handle Deploy
                if (eventType === 'deploy') {
                  setDeployEvent(data);
                }

                // Handle Orders / Syncs
                if (eventType === 'order' || eventType === 'sync') {
                  console.log('📦 Refreshing orders due to SSE event');
                  apiService.getOrders(1, 10).then(o => {
                    setOrders(o.orders);
                    setTotalOrders(o.total);
                  });
                }

                // Handle Notifications/Messages
                const isNotification = eventType === 'notification' || eventType === 'message';
                
                if (isNotification) {
                  console.log('✨ Refreshing notifications due to SSE event');
                  setUnreadNotifications(prev => prev + 1);
                  playNotificationSound();
                  
                  // Refetch to get actual list
                  fetchNotifications();

                  let contentObj: any = {};
                  try {
                    contentObj = typeof data.content === 'string' ? JSON.parse(data.content || '{}') : data.content;
                  } catch (err) {
                    contentObj = { body: data.content };
                  }

                  const title = contentObj?.title || data.title || 'Tecnogafas';
                  const body = contentObj?.body || data.body || data.message || 'Nueva notificación';

                  if (Capacitor.isNativePlatform()) {
                    LocalNotifications.schedule({
                      notifications: [
                        {
                          title,
                          body,
                          id: Math.floor(Math.random() * 1000000),
                          schedule: { at: new Date(Date.now() + 100) },
                        }
                      ]
                    });
                  } else if (Notification.permission === 'granted') {
                    navigator.serviceWorker.ready.then(reg => {
                      reg.showNotification(title, {
                        body,
                        icon: '/icon-192x192.png',
                        badge: '/icon-192x192.png',
                        tag: 'tecnogafas-notif',
                        vibrate: [200, 100, 200]
                      });
                    });
                  }
                }
              } catch (err) {
                console.warn('⚠️ SSE parse error or unexpected message format', err);
              }
            };

            es.onmessage = handleSSEEvent;
            es.addEventListener('message', handleSSEEvent);
            es.addEventListener('notification', handleSSEEvent);
            es.addEventListener('message_received', handleSSEEvent);
            es.addEventListener('deploy', handleSSEEvent);
            es.addEventListener('presence', handleSSEEvent);
            es.addEventListener('ping', handleSSEEvent);
            es.addEventListener('order', handleSSEEvent);
            es.addEventListener('sync', handleSSEEvent);

            es.onerror = (err) => {
              console.warn('⚠️ SSE connection error details:', {
                url: url.toString(),
                readyState: es.readyState,
                error: err
              });
              // if (es.readyState === EventSource.CLOSED) {
                console.log(`🔄 SSE connection lost. Re-establishing in ${retryDelay/1000}s...`);
                es.close();
                setTimeout(() => {
                  if (globalPin && isOnline) {
                    setRetrySSE(prev => prev + 1);
                    setRetryDelay(prev => Math.min(prev * 2, 30000));
                  }
                }, retryDelay);
              // }
            };
         }
      });
    }
    
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [globalPin, isOnline, retrySSE, syncAll]);

      return (
    <AppContext.Provider value={{
      products, clients, orders, totalOrders, grandTotalOrders, dashboardOrders, sellers, cart, drafts, isLoading, selectedClient, currentDraftId, primaryColor, fontSize, globalPin, currentSeller, apiError, onlineUsersCount, deployEvent, appVersionInfo, notifications, unreadNotifications, setSelectedClient,
      addToCart, removeFromCart, updateCartQuantity, clearCart, saveDraft, loadDraft, markDraftAsSent, setPrimaryColor: updatePrimaryColor, setFontSize: updateFontSize, setGlobalPin: updateGlobalPin, setApiError, setOnlineUsersCount, setTotalOrders, setDeployNotification, setUnreadNotifications, fetchNotifications, sendNotification, fetchOrders, refreshData, forceRefresh, initializePushNotifications
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
