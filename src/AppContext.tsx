import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product, Client, Order, CartItem } from './types';
import { apiService } from './services/apiService';

interface AppContextType {
  products: Product[];
  clients: Client[];
  orders: Order[];
  cart: CartItem[];
  isLoading: boolean;
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => void;
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [p, c, o] = await Promise.all([
        apiService.getProducts(),
        apiService.getClients(),
        apiService.getOrders(),
      ]);
      setProducts(p);
      setClients(c);
      setOrders(o);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
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
  };

  return (
    <AppContext.Provider value={{
      products, clients, orders, cart, isLoading, selectedClient, setSelectedClient,
      addToCart, removeFromCart, updateCartQuantity, clearCart, refreshData
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
