import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product, Client, Order, CartItem, DraftOrder, Seller } from './types';
import { apiService } from './services/apiService';

interface AppContextType {
  products: Product[];
  clients: Client[];
  orders: Order[];
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
  setPrimaryColor: (color: string) => void;
  setFontSize: (size: string) => void;
  refreshData: (showLoading?: boolean) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [drafts, setDrafts] = useState<DraftOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#1662E1');
  const [fontSize, setFontSize] = useState('16px');

  const refreshData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [p, c, o, s] = await Promise.all([
        apiService.getProducts(),
        apiService.getClients(),
        apiService.getOrders(),
        apiService.getSellers(),
      ]);
      setProducts(p);
      setClients(c);
      setOrders(o);
      setSellers(s);

      // Save to cache
      try {
        localStorage.setItem('tecnogafas_products', JSON.stringify(p));
        localStorage.setItem('tecnogafas_clients', JSON.stringify(c));
        // Omit rawData from orders before saving to cache to prevent quota exceeded
        const cachedOrders = o.map(({ rawData, ...rest }) => rest);
        localStorage.setItem('tecnogafas_orders', JSON.stringify(cachedOrders));
        localStorage.setItem('tecnogafas_sellers', JSON.stringify(s));
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
        const cachedProducts = localStorage.getItem('tecnogafas_products');
        const cachedClients = localStorage.getItem('tecnogafas_clients');
        const cachedOrders = localStorage.getItem('tecnogafas_orders');
        const cachedSellers = localStorage.getItem('tecnogafas_sellers');

        if (cachedProducts) { setProducts(JSON.parse(cachedProducts)); hasCache = true; }
        if (cachedClients) { setClients(JSON.parse(cachedClients)); hasCache = true; }
        if (cachedOrders) { setOrders(JSON.parse(cachedOrders)); hasCache = true; }
        if (cachedSellers) { setSellers(JSON.parse(cachedSellers)); hasCache = true; }
      } catch (e) {
        console.error('Error reading cache', e);
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

  return (
    <AppContext.Provider value={{
      products, clients, orders, sellers, cart, drafts, isLoading, selectedClient, currentDraftId, primaryColor, fontSize, setSelectedClient,
      addToCart, removeFromCart, updateCartQuantity, clearCart, saveDraft, loadDraft, markDraftAsSent, setPrimaryColor: updatePrimaryColor, setFontSize: updateFontSize, refreshData
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
