import React, { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import type { CartItem, Client, DraftOrder, Product, SharedCart } from '../types';
import { useAuth } from './AuthContext';

interface CartContextType {
  cart: CartItem[];
  drafts: DraftOrder[];
  sharedCarts: SharedCart[];
  selectedClient: Client | null;
  currentDraftId: string | null;
  setCart: (cart: CartItem[]) => void;
  setDrafts: (drafts: DraftOrder[]) => void;
  setSharedCarts: (carts: SharedCart[]) => void;
  setSelectedClient: (client: Client | null) => void;
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  clearCartAndClient: () => void;
  saveDraft: (details: Record<string, unknown>) => Promise<void>;
  loadDraft: (draftId: string) => void;
  markDraftAsSent: (draftId: string) => Promise<void>;
  shareCart: () => Promise<{ success: boolean; code: string; message: string; link: string }>;
  loadSharedCart: (
    code: string,
  ) => Promise<{ success: boolean; cart: SharedCart | null; message: string }>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { currentSeller } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [drafts, setDrafts] = useState<DraftOrder[]>([]);
  const [sharedCarts, setSharedCarts] = useState<SharedCart[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);

  useEffect(() => {
    const loadFromDexie = async () => {
      try {
        console.log('[CartContext] Starting data load from Dexie...');
        const { appDB } = await import('../stores/appDatabase');
        
        console.log('[CartContext] Database loaded, version:', appDB.verno);
        
        // Load cart items
        const cartItems = await appDB.cart.toArray();
        console.log('[CartContext] Found cart items:', cartItems.length);
        if (cartItems.length > 0) {
          setCart(cartItems);
          console.log('[CartContext] Cart loaded:', cartItems);
        }

        // Load selected client - try localStorage first, then Dexie
        console.log('[CartContext] Loading selected client...');
        
        let clientLoaded = false;
        
        // Approach 1: Try localStorage first (most reliable)
        try {
          const localStorageClient = localStorage.getItem('selectedClient');
          if (localStorageClient) {
            const parsedClient = JSON.parse(localStorageClient);
            console.log('[CartContext] Client loaded from localStorage:', parsedClient);
            setSelectedClient(parsedClient);
            clientLoaded = true;
            console.log('[CartContext] Client loaded successfully from localStorage');
          } else {
            console.log('[CartContext] No client found in localStorage');
          }
        } catch (localStorageError) {
          console.warn('[CartContext] localStorage read failed:', localStorageError);
        }
        
        // Approach 2: If localStorage failed, try Dexie
        if (!clientLoaded) {
          try {
            let selectedClients = await appDB.selectedClient.filter(client => client.isSelected).toArray();
            console.log('[CartContext] Dexie Approach 1 - Filter by isSelected:', selectedClients.length);
            
            // If no results, try where clause
            if (selectedClients.length === 0) {
              selectedClients = await appDB.selectedClient.where('isSelected').equals('true').toArray();
              console.log('[CartContext] Dexie Approach 2 - Where clause:', selectedClients.length);
            }
            
            // If still no results, check all records
            if (selectedClients.length === 0) {
              const allClients = await appDB.selectedClient.toArray();
              console.log('[CartContext] Dexie Approach 3 - All records:', allClients);
              
              selectedClients = allClients.filter(client => {
                const hasFlag = client.isSelected === true || client.isSelected === 'true';
                return hasFlag;
              });
              console.log('[CartContext] Dexie Approach 3 - Manual filter results:', selectedClients.length);
            }
            
            if (selectedClients.length > 0) {
              const selectedClientRecord = selectedClients[0];
              console.log('[CartContext] Loading client from Dexie:', selectedClientRecord);
              setSelectedClient({
                id: selectedClientRecord.id,
                name: selectedClientRecord.name,
                email: selectedClientRecord.email,
                phone: selectedClientRecord.phone,
                address: selectedClientRecord.address || '',
                billing_city: selectedClientRecord.billing_city || '',
                billing_state: selectedClientRecord.billing_state || '',
                cuit: selectedClientRecord.cuit || ''
              });
              clientLoaded = true;
              console.log('[CartContext] Client loaded successfully from Dexie');
              
              // Sync back to localStorage for future loads
              localStorage.setItem('selectedClient', JSON.stringify(selectedClientRecord));
              console.log('[CartContext] Synced client back to localStorage');
            } else {
              console.log('[CartContext] No selected client found in Dexie after all approaches');
            }
          } catch (dexieError) {
            console.warn('[CartContext] Dexie read failed:', dexieError);
          }
        }
        
        if (!clientLoaded) {
          console.log('[CartContext] No client loaded from any source');
        }

        // Load drafts
        const draftItems = await appDB.drafts.toArray();
        if (draftItems.length > 0) {
          setDrafts(draftItems);
          console.log('[CartContext] Drafts loaded:', draftItems.length);
        }

        // Load shared carts
        const sharedCartItems = await appDB.sharedCarts.toArray();
        if (sharedCartItems.length > 0) {
          setSharedCarts(sharedCartItems);
          console.log('[CartContext] Shared carts loaded:', sharedCartItems.length);
        }
        
        console.log('[CartContext] Data load completed');
      } catch (e) {
        console.error('[CartContext] Error loading data from Dexie:', e);
        console.error('[CartContext] Error details:', e.stack);
      }
    };
    loadFromDexie();
  }, []);

  useEffect(() => {
    const saveCartToDexie = async () => {
      try {
        const { appDB } = await import('../stores/appDatabase');
        await appDB.cart.clear();
        if (cart.length > 0) await appDB.cart.bulkPut(cart);
      } catch (e) {
        console.error('Error saving cart to Dexie:', e);
      }
    };
    saveCartToDexie();
  }, [cart]);

  useEffect(() => {
    const saveClientToDexie = async () => {
      try {
        // Save to localStorage as primary backup
        if (selectedClient) {
          localStorage.setItem('selectedClient', JSON.stringify(selectedClient));
          console.log('[CartContext] Client saved to localStorage:', selectedClient.name);
        } else {
          localStorage.removeItem('selectedClient');
          console.log('[CartContext] Client removed from localStorage');
        }

        // Also try to save to Dexie as secondary storage
        try {
          const { appDB } = await import('../stores/appDatabase');
          await appDB.selectedClient.clear();
          if (selectedClient) {
            // Store the selected client with their actual ID
            // Add a flag to identify this as the selected client
            const clientWithFlag = {
              ...selectedClient,
              isSelected: true, // Flag to identify this as the selected client
              timestamp: Date.now() // Add timestamp for debugging
            };
            await appDB.selectedClient.add(clientWithFlag);
            console.log('[CartContext] Client also saved to Dexie:', clientWithFlag);
          }
        } catch (dexieError) {
          console.warn('[CartContext] Dexie save failed, but localStorage worked:', dexieError);
        }
      } catch (e) {
        console.error('[CartContext] Error saving selected client:', e);
      }
    };
    saveClientToDexie();
  }, [selectedClient]);

  const addToCart = (product: Product, quantity: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((item) => item.id !== productId));

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) => prev.map((item) => (item.id === productId ? { ...item, quantity } : item)));
  };

  const clearCart = () => {
    setCart([]);
    setCurrentDraftId(null);
  };

  const clearCartAndClient = () => {
    setCart([]);
    setSelectedClient(null);
    setCurrentDraftId(null);
  };

  const saveDraft = async (details: Record<string, unknown>) => {
    if (!selectedClient || cart.length === 0) return;
    let updatedDrafts: DraftOrder[];
    if (currentDraftId) {
      updatedDrafts = drafts.map((d) =>
        d.id === currentDraftId
          ? {
              ...d,
              client: selectedClient,
              items: [...cart],
              details,
              date: new Date().toISOString(),
            }
          : d,
      );
    } else {
      updatedDrafts = [
        ...drafts,
        {
          id: `draft_${Date.now()}`,
          client: selectedClient,
          items: [...cart],
          details,
          status: 'no enviado',
          date: new Date().toISOString(),
        },
      ];
    }
    setDrafts(updatedDrafts);
    try {
      const { appDB } = await import('../stores/appDatabase');
      await appDB.drafts.clear();
      if (updatedDrafts.length > 0) await appDB.drafts.bulkPut(updatedDrafts);
    } catch (e) {
      console.error('Error saving drafts to Dexie:', e);
    }
    clearCart();
  };

  const loadDraft = (draftId: string) => {
    const draft = drafts.find((d) => d.id === draftId);
    if (draft) {
      setCart(draft.items);
      setSelectedClient(draft.client);
      setCurrentDraftId(draft.id);
    }
  };

  const markDraftAsSent = async (draftId: string) => {
    const updatedDrafts = drafts.map((d) =>
      d.id === draftId ? { ...d, status: 'enviado' as const } : d,
    );
    setDrafts(updatedDrafts);
    try {
      const { appDB } = await import('../stores/appDatabase');
      await appDB.drafts.clear();
      if (updatedDrafts.length > 0) await appDB.drafts.bulkPut(updatedDrafts);
    } catch (e) {
      console.error('Error saving drafts to Dexie:', e);
    }
  };

  const shareCart = async () => {
    if (!selectedClient || cart.length === 0) {
      return { success: false, code: '', message: 'Carrito vacío o sin cliente', link: '' };
    }

    try {
      const { supabase } = await import('../modules/chat/lib/supabase');
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await (supabase as any)
        .from('shared_carts')
        .insert({
          code,
          client_id: selectedClient.id,
          client_name: selectedClient.name,
          items: cart,
          seller_id: currentSeller?.id,
          expires_at: expiresAt.toISOString(),
          metadata: {
            total: cart.reduce((acc, item) => acc + item.price * item.quantity, 0),
          },
        } as Record<string, unknown>)
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

  const loadSharedCart = async (
    code: string,
  ): Promise<{ success: boolean; cart: SharedCart | null; message: string }> => {
    try {
      const { supabase } = await import('../modules/chat/lib/supabase');
      const { data, error } = await supabase
        .from('shared_carts')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return { success: false, cart: null, message: 'Carrito no encontrado o expirado' };
      }

      const sharedCartData = data as {
        id: string;
        code: string;
        items: CartItem[];
        created_at: string;
        expires_at: string;
        is_active: boolean;
        metadata?: { total?: number };
      };

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
        isActive: sharedCartData.is_active,
      };

      const updatedSharedCarts = [mappedCart, ...sharedCarts.filter((c) => c.id !== mappedCart.id)];
      setSharedCarts(updatedSharedCarts);
      try {
        const { appDB } = await import('../stores/appDatabase');
        await appDB.sharedCarts.clear();
        if (updatedSharedCarts.length > 0) await appDB.sharedCarts.bulkPut(updatedSharedCarts);
      } catch (e) {
        console.error('Error saving shared carts to Dexie:', e);
      }

      return { success: true, cart: mappedCart, message: 'Carrito cargado exitosamente' };
    } catch (error) {
      console.error('Error loading shared cart:', error);
      return { success: false, cart: null, message: 'Error al cargar carrito compartido' };
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        drafts,
        sharedCarts,
        selectedClient,
        currentDraftId,
        setCart,
        setDrafts,
        setSharedCarts,
        setSelectedClient: (client) => {
      console.log('[CartContext] setSelectedClient called with:', client);
      setSelectedClient(client);
    },
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        clearCartAndClient,
        saveDraft,
        loadDraft,
        markDraftAsSent,
        shareCart,
        loadSharedCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
