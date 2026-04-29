import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { get, set, del } from 'idb-keyval';
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

  const fetchNotifications = useCallback(async () => {
    if (!globalPin) return;
    try {
      console.log('📡 Syncing notifications from server...');
      const data = await apiService.getEvents(undefined, globalPin);
      setNotifications(data);
      const unread = await apiService.getUnreadCount(globalPin);
      setUnreadNotifications(unread);
    } catch (e) {
      console.error('Error fetching notifications', e);
    }
  }, [globalPin]);

  const syncAll = useCallback(async () => {
    console.log('🔄 Performing global sync via SSE trigger...');
    await Promise.all([
      fetchNotifications(),
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
    const loadCachedAndRefresh = async () => {
      let hasCache = false;
      try {
        const cachedProducts = await get<Product[]>('tecnogafas_products');
        const cachedClients = await get<Client[]>('tecnogafas_clients');
        const cachedOrdersData = await get<Order[]>('tecnogafas_orders');
        const cachedSellers = await get<Seller[]>('tecnogafas_sellers');

        if (cachedProducts) { setProducts(cachedProducts); hasCache = true; }
        if (cachedClients) { setClients(cachedClients); hasCache = true; }
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

      if (globalPin) {
        apiService.getUnreadCount(globalPin).then(setUnreadNotifications);
        fetchNotifications();
      }

      if (hasCache) {
        setIsLoading(false);
      }
      
      // Refresh data in the background (or show loading if no cache)
      await refreshData(!hasCache);
    };

    loadCachedAndRefresh();

    const savedDrafts = localStorage.getItem('tecnogafas_drafts');
    if (savedDrafts) {
      try {
        setDrafts(JSON.parse(savedDrafts));
      } catch (e) {
        console.error('Error parsing drafts', e);
      }
    }
    const savedPrimaryColor = localStorage.getItem('tecnogafas_primaryColor');
    if (savedPrimaryColor) setPrimaryColor(savedPrimaryColor);
    const savedFontSize = localStorage.getItem('tecnogafas_fontSize');
    if (savedFontSize) setFontSize(savedFontSize);
  }, []);

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

  const saveDraft = (details: any) => {
    if (!selectedClient || cart.length === 0) return;
    
    const newDraft: DraftOrder = {
      id: `draft_${Date.now()}`,
      client: selectedClient,
      items: [...cart],
      details,
      status: 'no enviado',
      date: new Date().toISOString(),
    };

    const updatedDrafts = [...drafts, newDraft];
    setDrafts(updatedDrafts);
    localStorage.setItem('tecnogafas_drafts', JSON.stringify(updatedDrafts));
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

  const markDraftAsSent = (draftId: string) => {
    const updatedDrafts = drafts.map(d => d.id === draftId ? { ...d, status: 'enviado' as const } : d);
    setDrafts(updatedDrafts);
    localStorage.setItem('tecnogafas_drafts', JSON.stringify(updatedDrafts));
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
    // Check and trigger manual sync
    const handleOnline = async () => {
      console.log('Online, manually triggering sync...');
      setIsOnline(true);
      if (!('indexedDB' in window)) return;
      
      const dbRequest = indexedDB.open('tecnogafas-sync', 1);
      dbRequest.onsuccess = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('pending-orders')) return;
        const tx = db.transaction('pending-orders', 'readonly');
        const store = tx.objectStore('pending-orders');
        const req = store.getAll();
        
        req.onsuccess = async () => {
          for (const item of req.result) {
            try {
              const response = await fetch(item.url, {
                method: 'POST',
                headers: item.headers,
                body: item.body
              });
              if (response.ok) {
                const txDel = db.transaction('pending-orders', 'readwrite');
                txDel.objectStore('pending-orders').delete(item.id);
                console.log('Manually synced order:', item.id);
              }
            } catch (e) {
              console.error('Manual sync failed for', item.id);
            }
          }
        };
      };
    };

    const handleOffline = () => {
      console.log('Sin conexión');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    handleOnline(); 

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

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('api-error', handleApiError);
    };
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    
    if (globalPin && isOnline) {
      // Start SSE if pin is available and online
      apiService.loginSeller(globalPin).then(seller => {
         if (seller) {
            setCurrentSeller(seller);
            
            const lastId = localStorage.getItem('tecnogafas_last_event_id') || '';
            const url = new URL('https://api.tecnogafas.com.ar/events/stream');
            
            // Per README v2.5.0, EventSource uses user_id in query string, 
            // but we keep token for backward compatibility and internal auth
            url.searchParams.set('user_id', seller.id.toString());
            url.searchParams.set('token', globalPin);
            if (lastId) {
              url.searchParams.set('last_id', lastId);
            }

            console.log(`🔌 Connecting SSE for ID: ${seller.id}...`);
            const es = new EventSource(url.toString());
            eventSource = es;
 
            // 🔹 Handshake
            es.onopen = () => {
              console.log('✅ SSE Connection established');
              setRetryDelay(5000); // Reset backoff on success
              syncAll(); // Refresh data as soon as we connect
            };

            es.addEventListener('connected', (e: any) => {
              try {
                const data = JSON.parse(e.data);
                console.log('📡 SSE Handshake:', data);
                if (data.onlineCount !== undefined || data.count !== undefined) {
                  setOnlineUsersCount(data.onlineCount ?? data.count ?? 0);
                }
              } catch (err) {
                console.log('📡 SSE connected event received');
              }
            });

            // Heartbeat / Presence
            es.addEventListener('ping', (e: any) => {
              try {
                const data = JSON.parse(e.data);
                if (data.onlineCount !== undefined || data.count !== undefined) {
                  setOnlineUsersCount(data.onlineCount ?? data.count ?? 0);
                }
              } catch (err) {}
            });

            const handleSSEEvent = (event: MessageEvent) => {
              try {
                const data = JSON.parse(event.data);
                if (data.message === 'max runtime reached' || data.keepalive === true) return;
                
                if (event.lastEventId) {
                  localStorage.setItem('tecnogafas_last_event_id', event.lastEventId);
                }

                console.log(`🔔 SSE Event [${event.type}]:`, data);

                // Handle Presence updates
                if (data.type === 'presence' || data.onlineCount !== undefined) {
                  setOnlineUsersCount(data.onlineCount ?? data.count);
                }

                // Handle Deploy
                if (data.type === 'deploy' || event.type === 'deploy') {
                  setDeployEvent(data);
                }

                // Handle Notifications/Messages -> GLOBAL ACTION
                const isNotification = data.type === 'notification' || data.type === 'message' || event.type === 'notification' || event.type === 'message';
                
                if (isNotification) {
                  console.log('✨ Refreshing notifications globally due to SSE event');
                  setUnreadNotifications(prev => prev + 1);
                  playNotificationSound();
                  
                  // SYNC: Always re-fetch to ensure the list is updated and ordered correctly
                  fetchNotifications();

                  if (Notification.permission === 'granted') {
                    navigator.serviceWorker.ready.then(reg => {
                      let contentObj: any = {};
                      try {
                        contentObj = typeof data.content === 'string' ? JSON.parse(data.content || '{}') : data.content;
                      } catch (err) {
                        contentObj = { body: data.content };
                      }
                      
                      reg.showNotification(contentObj?.title || data.title || 'TecnoGafas', {
                        body: contentObj?.body || data.body || data.message || 'Nueva notificación',
                        icon: '/icon-192x192.png',
                        badge: '/icon-192x192.png',
                        tag: 'tecnogafas-notif'
                      });
                    });
                  }
                }
              } catch (err) {
                console.warn('⚠️ SSE parse error', err);
              }
            };

            es.onmessage = handleSSEEvent;
            es.addEventListener('message', handleSSEEvent);
            es.addEventListener('notification', handleSSEEvent);
            es.addEventListener('deploy', handleSSEEvent);

            es.onerror = (err) => {
              if (es.readyState === EventSource.CLOSED) {
                console.log(`🔄 SSE connection dropped. Re-establishing in ${retryDelay/1000}s...`);
                es.close();
                setTimeout(() => {
                  if (globalPin && isOnline) {
                    setRetrySSE(prev => prev + 1);
                    setRetryDelay(prev => Math.min(prev * 2, 30000)); // Exponential backoff up to 30s
                  }
                }, retryDelay);
              }
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
      addToCart, removeFromCart, updateCartQuantity, clearCart, saveDraft, loadDraft, markDraftAsSent, setPrimaryColor: updatePrimaryColor, setFontSize: updateFontSize, setGlobalPin: updateGlobalPin, setApiError, setOnlineUsersCount, setTotalOrders, setDeployNotification, setUnreadNotifications, fetchNotifications, sendNotification, fetchOrders, refreshData, forceRefresh
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
