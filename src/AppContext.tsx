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
  refreshData: () => Promise<void>;
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

  const refreshData = async () => {
    setIsLoading(true);
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
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const savedDrafts = localStorage.getItem('tecnogafas_drafts');
    if (savedDrafts) {
      try {
        setDrafts(JSON.parse(savedDrafts));
      } catch (e) {
        console.error('Error parsing drafts', e);
      }
    }
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

  return (
    <AppContext.Provider value={{
      products, clients, orders, sellers, cart, drafts, isLoading, selectedClient, currentDraftId, setSelectedClient,
      addToCart, removeFromCart, updateCartQuantity, clearCart, saveDraft, loadDraft, markDraftAsSent, refreshData
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
