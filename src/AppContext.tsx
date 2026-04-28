import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { get, set } from 'idb-keyval';
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
  sendNotification: (toUserId: number, content: string, type?: 'message' | 'notification') => Promise<boolean>;
  fetchOrders: (page: number, perPage: number, sellerId?: number, customerId?: number) => Promise<void>;
  refreshData: (showLoading?: boolean) => Promise<void>;
  forceRefresh: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

import { fetchEventSource } from '@microsoft/fetch-event-source';

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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

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
        content: { text: content, sender: currentSeller?.name || 'Vendedor' }
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

  const refreshData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [p, c, o, s] = await Promise.all([
        apiService.getProducts(),
        apiService.getClients(),
        apiService.getOrders(1, 25), // Fetch first page
        apiService.getSellers(),
      ]);
      setProducts(p);
      setClients(c);
      setOrders(o.orders);
      setTotalOrders(o.total);
      setGrandTotalOrders(o.total);
      setDashboardOrders(o.orders.slice(0, 5));
      setSellers(s);

      // Save to cache
      try {
        await set('tecnogafas_products', p);
        await set('tecnogafas_clients', c);
        // Omit rawData from orders before saving to cache to prevent quota exceeded
        const cachedOrders = o.orders.map(({ rawData, ...rest }) => rest);
        await set('tecnogafas_orders', cachedOrders);
        await set('tecnogafas_sellers', s);
      } catch (cacheError) {
        console.warn('Failed to save to local storage cache (quota may be exceeded)', cacheError);
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setIsLoading(false);
    }
  };

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
    let abortController: AbortController | null = null;
    
    // Check and trigger manual sync
    const handleOnline = async () => {
      console.log('Online, manually triggering sync...');
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

    window.addEventListener('online', handleOnline);
    handleOnline(); // Run on initial load to clear any pending syncs

    const handleApiError = (e: any) => {
      const msg = e.detail?.message || 'Error de API';
      setApiError(msg);
      
      // Dispatch push notification
      if ('Notification' in window && Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('Alerta de Conexión', {
              body: msg,
              icon: '/icon.png',
              badge: '/icon.png'
            });
          });
      }

      // Hide after a few seconds
      setTimeout(() => {
        setApiError(null);
      }, 5000);
    };

    window.addEventListener('api-error', handleApiError);

    const savedPin = localStorage.getItem('tecnogafas_pin');
    if (savedPin) {
      setGlobalPin(savedPin);
      
      // Start SSE if pin is available and valid
      apiService.loginSeller(savedPin).then(seller => {
         if (seller) {
            setCurrentSeller(seller);
            abortController = new AbortController();
            fetchEventSource('https://api.tecnogafas.com.ar/events/stream', {
              headers: {
                'Authorization': `Bearer ${savedPin}`,
                'Accept': 'text/event-stream'
              },
              signal: abortController.signal,
              async onopen(res) {
                if (res.ok && res.status === 200) {
                  console.log('SSE connection established');
                } else {
                  console.error('SSE connection failed', res);
                }
              },
              onmessage(event) {
                try {
                  const data = JSON.parse(event.data);
                  
                  // Ignore system maintenance/keep-alive messages
                  if (data.message === 'max runtime reached' || data.keepalive === true) {
                      return;
                  }
                  
                  console.log('Notification received:', data);
                  
                  // Check if it's a presence event or has online users count
                  if (data.type === 'presence' || data.onlineCount !== undefined) {
                      setOnlineUsersCount(data.onlineCount ?? data.count);
                      return; // Don't show push notification just for presence update
                  }

                  if (data.type === 'deploy') {
                      setDeployNotification(data);
                  }

                  if (data.type === 'notification' || data.type === 'message') {
                    setUnreadNotifications(prev => prev + 1);
                    playNotificationSound();
                    // Optionally refresh notifications list if on that page
                  }

                  if (Notification.permission === 'granted') {
                    navigator.serviceWorker.ready.then(reg => {
                      reg.showNotification(data.title || 'TecnoGafas', {
                        body: data.body || JSON.stringify(data),
                        icon: '/icon.png',
                        badge: '/icon.png'
                      });
                    });
                  }
                } catch(e) {
                  console.warn('Could not parse SSE message:', event.data);
                }
              },
              onerror(err) {
                console.error('SSE Error:', err);
                // optionally we could throw an error to prevent reconnects on fatal errors
              }
            });
         }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('api-error', handleApiError);
      if (abortController) {
        abortController.abort();
      }
    };
  }, []);

      return (
    <AppContext.Provider value={{
      products, clients, orders, totalOrders, grandTotalOrders, dashboardOrders, sellers, cart, drafts, isLoading, selectedClient, currentDraftId, primaryColor, fontSize, globalPin, currentSeller, apiError, onlineUsersCount, deployEvent, notifications, unreadNotifications, setSelectedClient,
      addToCart, removeFromCart, updateCartQuantity, clearCart, saveDraft, loadDraft, markDraftAsSent, setPrimaryColor: updatePrimaryColor, setFontSize: updateFontSize, setGlobalPin: updateGlobalPin, setApiError, setOnlineUsersCount, setTotalOrders, setDeployNotification, setUnreadNotifications, sendNotification, fetchOrders, refreshData, forceRefresh
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
