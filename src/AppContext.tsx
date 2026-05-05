import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { get, set, del } from 'idb-keyval';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Product, Client, Order, CartItem, DraftOrder, Seller, SharedCart } from './types';
import { syncAllPendingOrders, getPendingOrders } from './services/pendingOrdersSync';
import { apiService } from './services/apiService';
import { useNotifications } from './hooks/context/useNotifications';
import { useDataSync } from './hooks/context/useDataSync';
import { useCacheManager } from './hooks/context/useCacheManager';

interface AppContextType {
  supabaseUser: any;
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
  shareCart: () => Promise<{ success: boolean; code: string; message: string; link: string }>;
  loadSharedCart: (code: string) => Promise<{ success: boolean; cart: SharedCart | null; message: string }>;
  syncPendingOrders: () => Promise<void>;
  sharedCarts: SharedCart[];
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
  const [sharedCarts, setSharedCarts] = useState<SharedCart[]>([]);
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
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);

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
    
    // Refresh notifications desactivado (Events API)
    // await fetchNotifications();
  }, [globalPin, currentSeller, notifications]);

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
        // fetchNotifications(); // Desactivado (Events API)
      });
    } catch (e) {
      console.error('Error initializing Push Notifications', e);
    }
  }, [hasNotificationBeenShown, markNotificationAsShown]);

  const syncAll = useCallback(async () => {
    console.log('🔄 Performing global sync...');
    await Promise.all([
      // fetchNotifications(), // Desactivado (Events API)
      apiService.getOrders(1, 10, globalPin || undefined).then(o => {
        setOrders(o.orders);
        setTotalOrders(o.total);
      }),
      apiService.getProducts().then(setProducts)
    ]);
  }, [globalPin]);

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

  const updateTheme = useCallback((newTheme: 'light' | 'dark', isManual = true) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('tecnogafas_theme', newTheme);
    // Si es cambio manual, marcar para desactivar auto-theme
    if (isManual) {
      localStorage.setItem('tecnogafas_theme_manual', 'true');
    }
  }, []);

  // Función para volver al modo automático (opcional, para futuro toggle)
  const resetThemeToAuto = useCallback(() => {
    localStorage.removeItem('tecnogafas_theme_manual');
    const autoTheme = detectBuenosAiresTheme();
    setTheme(autoTheme);
    document.documentElement.setAttribute('data-theme', autoTheme);
    // No guardamos en localStorage para que la próxima vez detecte automáticamente
  }, [detectBuenosAiresTheme]);

  const updateGlobalPin = async (pin: string | null) => {
    setGlobalPin(pin);
    if (pin) {
      localStorage.setItem('tecnogafas_pin', pin);
      // Sincronizar con Supabase Auth (esto disparará onAuthStateChange)
      try {
        await apiService.syncSupabaseAuth(pin);
      } catch (err) {
        console.error('Error in Supabase Auth sync:', err);
      }
      
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'START_POLLING', pin: pin });
        navigator.serviceWorker.controller.postMessage({ type: 'APP_ACTIVE' });
      }
    } else {
      localStorage.removeItem('tecnogafas_pin');
      // Cerrar sesión en Supabase
      try {
        const { supabase } = await import('./modules/chat/lib/supabase');
        await supabase.auth.signOut();
        setSupabaseUser(null);
        setUnreadNotifications(0);
      } catch (err) {
        console.error('Error signing out from Supabase:', err);
      }
      
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'STOP_POLLING' });
      }
    }
  };

  // Función para sincronizar pedidos pendientes
  const syncPendingOrders = useCallback(async (sellerId: string) => {
    if (!isOnline) return;
    
    console.log('🔄 Checking for pending orders to sync...');
    try {
      setConnectionStatus('syncing');
      const result = await syncAllPendingOrders(sellerId);
      
      if (result.total > 0) {
        console.log(`✅ Synced ${result.success} orders, ${result.failed} failed`);
        // Refrescar la lista de pedidos si se sincronizó alguno exitosamente
        if (result.success > 0) {
          await refreshData();
        }
      }
      
      // Actualizar contador
      const pending = await getPendingOrders(sellerId, ['pending', 'failed']);
      setPendingOrdersCount(pending.length);
      
      setConnectionStatus('online');
    } catch (err) {
      console.error('Error syncing pending orders:', err);
      setConnectionStatus('error');
    }
  }, [isOnline, refreshData]);

  // Remaining useEffect logic for SSE and initialization
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionStatus('online');
      // Sincronizar pedidos pendientes al recuperar conexión
      const savedPin = localStorage.getItem('tecnogafas_pin');
      if (savedPin) {
        syncPendingOrders(savedPin);
      }
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
      apiService.syncSupabaseAuth(savedPin);
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
        const cachedSharedCarts = await get<SharedCart[]>('tecnogafas_shared_carts');

        if (cachedProducts) { setProducts(cachedProducts); hasCache = true; }
        if (cachedClients) { setClients(cachedClients); hasCache = true; }
        if (cachedDrafts) { setDrafts(cachedDrafts); }
        if (cachedSharedCarts) { setSharedCarts(cachedSharedCarts); }
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

      // Inicializar tema: verificar si fue seteado manualmente
      const savedTheme = localStorage.getItem('tecnogafas_theme') as 'light' | 'dark' | null;
      const isManual = localStorage.getItem('tecnogafas_theme_manual') === 'true';
      
      if (savedTheme && isManual) {
        // Usuario eligió manualmente - respetar su elección
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else if (savedTheme && !isManual) {
        // Había un tema guardado pero no fue manual (vieja lógica)
        // Detectar automáticamente y actualizar
        const autoTheme = detectBuenosAiresTheme();
        setTheme(autoTheme);
        document.documentElement.setAttribute('data-theme', autoTheme);
        localStorage.setItem('tecnogafas_theme', autoTheme);
      } else {
        // Primera vez - detectar automáticamente
        const autoTheme = detectBuenosAiresTheme();
        setTheme(autoTheme);
        document.documentElement.setAttribute('data-theme', autoTheme);
        localStorage.setItem('tecnogafas_theme', autoTheme);
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

  // 1. Escuchar cambios de autenticación en Supabase
  useEffect(() => {
    let authSubscription: any = null;

    const initAuth = async () => {
      const { supabase } = await import('./modules/chat/lib/supabase');
      
      // Obtener sesión inicial
      const { data: { session } } = await supabase.auth.getSession();
      setSupabaseUser(session?.user ?? null);

      // Suscribirse a cambios
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        console.log('🔐 Supabase Auth Event:', _event, session?.user?.email);
        setSupabaseUser(session?.user ?? null);
      });
      authSubscription = subscription;
    };

    initAuth();

    return () => {
      if (authSubscription) authSubscription.unsubscribe();
    };
  }, []);

  // 2. Suscribirse a notificaciones globales cuando el usuario esté autenticado
  const globalChannelRef = React.useRef<any>(null);

  useEffect(() => {
    if (!supabaseUser || !isOnline) {
      if (!supabaseUser) setUnreadNotifications(0);
      return;
    }

    const setupGlobalNotifications = async () => {
      try {
        // Limpiar suscripción previa si existe
        if (globalChannelRef.current) {
          await apiService.unsubscribeSupabase(globalChannelRef.current);
          globalChannelRef.current = null;
        }

        // 1. Buscar el ID del canal de #notificaciones
        const { data: conv, error: convError } = await apiService.getSupabaseNotificationChannel();
        if (convError || !conv) {
          console.error("Error fetching notification channel:", convError);
          return;
        }

        // 2. Cargar contador inicial de no leídos usando el ID de Supabase
        const { data: member, error: memberError } = await apiService.getSupabaseMemberStatus(conv.id, supabaseUser.id);
        if (member && !memberError) {
          setUnreadNotifications(member.unread_count || 0);
        }

        // 3. Suscribirse a cambios en mensajes para este canal
        globalChannelRef.current = await apiService.subscribeToSupabaseTable(
          'messages',
          `conversation_id=eq.${conv.id}`,
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setUnreadNotifications(prev => prev + 1);
              
              if (window.location.pathname !== '/chat') {
                const msg = payload.new;
                LocalNotifications.schedule({
                  notifications: [{
                    title: 'Nueva Notificación',
                    body: msg.content || 'Tienes un nuevo mensaje del sistema',
                    id: Date.now(),
                    extra: { event_id: msg.id }
                  }]
                });
              }
            }
          }
        );
      } catch (err) {
        console.error('Error setting up global notifications:', err);
      }
    };

    setupGlobalNotifications();

    return () => {
      if (globalChannelRef.current) {
        apiService.unsubscribeSupabase(globalChannelRef.current);
        globalChannelRef.current = null;
      }
    };
  }, [supabaseUser, isOnline]);

  // Efecto para actualizar tema automáticamente SOLO si no fue manual
  useEffect(() => {
    // Verificar si el tema fue seteado manualmente
    const isManual = localStorage.getItem('tecnogafas_theme_manual') === 'true';
    if (isManual) {
      // No actualizar automáticamente si el usuario eligió manualmente
      return;
    }

    const checkTheme = () => {
      const autoTheme = detectBuenosAiresTheme();
      const currentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
      if (autoTheme !== currentTheme) {
        setTheme(autoTheme);
        document.documentElement.setAttribute('data-theme', autoTheme);
        localStorage.setItem('tecnogafas_theme', autoTheme);
      }
    };

    // Verificar inmediatamente y luego cada minuto
    checkTheme();
    const interval = setInterval(checkTheme, 60000);

    return () => clearInterval(interval);
  }, [detectBuenosAiresTheme]);

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

  const shareCart = async () => {
    if (!selectedClient || cart.length === 0) {
      return { success: false, code: '', message: 'Carrito vacío o sin cliente', link: '' };
    }

    try {
      const { supabase } = await import('./modules/chat/lib/supabase');
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      const { data, error } = await (supabase as any)
        .from('shared_carts')
        .insert({
          code,
          client_id: selectedClient.id,
          client_name: selectedClient.name,
          items: cart,
          seller_id: currentSeller?.id,
          expires_at: expiresAt.toISOString(),
          metadata: {
            total: cart.reduce((acc, item) => acc + item.price * item.quantity, 0)
          }
        })
        .select()
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/shared-cart/${code}`;
      return { success: true, code, message: 'Carrito compartido exitosamente', link };

    } catch (error) {
      console.error('Error sharing cart:', error);
      return { success: false, code: '', message: 'Error al generar enlace compartido', link: '' };
    }
  };

  const loadSharedCart = async (code: string): Promise<{ success: boolean; cart: SharedCart | null; message: string }> => {
    try {
      const { supabase } = await import('./modules/chat/lib/supabase');
      const { data, error } = await supabase
        .from('shared_carts')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return { success: false, cart: null, message: 'Carrito no encontrado o expirado' };
      }

      const sharedCartData = data as any;

      // Check if expired
      if (new Date(sharedCartData.expires_at) < new Date()) {
        return { success: false, cart: null, message: 'Este carrito ha expirado' };
      }

      const mappedCart: SharedCart = {
        id: sharedCartData.id,
        code: sharedCartData.code,
        items: sharedCartData.items,
        total: sharedCartData.metadata?.total || 0,
        createdAt: sharedCartData.created_at,
        expiresAt: sharedCartData.expires_at,
        isActive: sharedCartData.is_active
      };

      // Update local cache
      const updatedSharedCarts = [mappedCart, ...sharedCarts.filter(c => c.id !== mappedCart.id)];
      setSharedCarts(updatedSharedCarts);
      await set('tecnogafas_shared_carts', updatedSharedCarts);

      return { success: true, cart: mappedCart, message: 'Carrito cargado exitosamente' };

    } catch (error) {
      console.error('Error loading shared cart:', error);
      return { success: false, cart: null, message: 'Error al cargar carrito compartido' };
    }
  };

  // Efecto para actualizar tema automáticamente SOLO si no fue manual
  useEffect(() => {
    // Verificar si el tema fue seteado manualmente
    const isManual = localStorage.getItem('tecnogafas_theme_manual') === 'true';
    if (isManual) {
      // No actualizar automáticamente si el usuario eligió manualmente
      return;
    }

    const checkTheme = () => {
      const autoTheme = detectBuenosAiresTheme();
      const currentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
      if (autoTheme !== currentTheme) {
        setTheme(autoTheme);
        document.documentElement.setAttribute('data-theme', autoTheme);
        localStorage.setItem('tecnogafas_theme', autoTheme);
      }
    };

    // Verificar inmediatamente y luego cada minuto
    checkTheme();
    const interval = setInterval(checkTheme, 60000);

    return () => clearInterval(interval);
  }, [detectBuenosAiresTheme]);

  // SSE desactivado temporalmente por problemas de conexión
  useEffect(() => {
    console.log(' SSE desactivado');
    return;
  }, []);

  return (
    <AppContext.Provider value={{
      supabaseUser, products, clients, orders, totalOrders, grandTotalOrders, dashboardOrders, sellers, cart, drafts, sharedCarts, isLoading, selectedClient, currentDraftId, primaryColor, fontSize, globalPin, currentSeller, apiError, onlineUsersCount, deployEvent, appVersionInfo, notifications, unreadNotifications, theme, isOnline, connectionStatus, setNotifications, setSelectedClient,
      addToCart, removeFromCart, updateCartQuantity, clearCart, saveDraft, loadDraft, markDraftAsSent, shareCart, loadSharedCart, setPrimaryColor: updatePrimaryColor, setFontSize: updateFontSize, setGlobalPin: updateGlobalPin, setApiError, setOnlineUsersCount, setTotalOrders, setDeployNotification, setUnreadNotifications, setTheme: updateTheme, fetchNotifications, sendNotification, fetchOrders, refreshData, forceRefresh, initializePushNotifications, clearAllCaches, hasNewVersion, currentAppVersion,
      markAllNotificationsAsRead, markNotificationAsShown, hasNotificationBeenShown,
      syncPendingOrders: async () => { if (globalPin) await syncPendingOrders(globalPin); }
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
