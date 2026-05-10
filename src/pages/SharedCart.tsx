import { AlertCircle, ArrowLeft, CheckCircle, Package, RefreshCw, ShoppingBag } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { cn, formatCurrency } from '../lib/utils';
import type { CartItem, SharedCart as SharedCartType } from '../types';

interface SharedCartRow {
  id: string;
  code: string;
  items: CartItem[];
  metadata?: { total?: number };
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

export default function SharedCart() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [sharedCart, setSharedCart] = useState<SharedCartType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSharedCartData = async () => {
      try {
        const { supabase } = await import('../modules/chat/lib/supabase');
        const sharedCartsTable = (
          supabase as unknown as {
            from: (table: 'shared_carts') => {
              select: (columns: string) => {
                eq: (
                  column: string,
                  value: string | boolean | undefined,
                ) => {
                  eq: (
                    column: string,
                    value: string | boolean | undefined,
                  ) => {
                    single: () => Promise<{
                      data: SharedCartRow | null;
                      error: { message: string } | null;
                    }>;
                  };
                };
              };
            };
          }
        ).from('shared_carts');

        const { data, error } = await sharedCartsTable
          .select('*')
          .eq('code', code)
          .eq('is_active', true)
          .single();

        if (error || !data) {
          setError('Carrito no encontrado o expirado');
          return;
        }

        if (new Date(data.expires_at) < new Date()) {
          setError('Este carrito ha expirado');
          return;
        }

        const mappedCart: SharedCartType = {
          id: data.id,
          code: data.code,
          items: data.items,
          total: data.metadata?.total || 0,
          createdAt: data.created_at,
          expiresAt: data.expires_at,
          isActive: data.is_active,
        };

        setSharedCart(mappedCart);
        setError(null);
      } catch (err) {
        console.error('Error loading shared cart:', err);
        setError('Error al cargar el carrito compartido');
      } finally {
        setLoading(false);
      }
    };

    loadSharedCartData();
  }, [code]);

  const {
    loadSharedCart: loadSharedCartAction,
    addToCart,
    setSelectedClient,
    clearCart,
  } = useCart();

  const handleContinueToCheckout = async () => {
    if (!sharedCart) return;

    try {
      const result = await loadSharedCartAction(sharedCart.code);

      if (result.success && result.cart) {
        if (result.cart.client) setSelectedClient(result.cart.client);
        clearCart();
        result.cart.items.forEach((item) => {
          const productToLoad = {
            id: item.id.toString(),
            name: item.name,
            category: item.category || 'General',
            price: item.price,
            stock: item.stock || 999,
            image: item.image || '',
            description: item.description || '',
            variations: item.vid
              ? [
                  {
                    vid: item.vid.toString(),
                    title: item.name,
                    stock: item.quantity,
                    price: item.price,
                  },
                ]
              : undefined,
          };
          addToCart(productToLoad, item.quantity);
        });
        navigate('/carrito');
      } else {
        setError(result.message || 'Error al cargar el carrito');
      }
    } catch (error) {
      console.error('Error in handleContinueToCheckout:', error);
      setError('Error al continuar al checkout');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-4">
        <RefreshCw size={40} className="text-primary animate-spin" />
        <p className="text-[var(--color-text-muted)] font-medium">
          Recuperando carrito compartido...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="text-center max-w-sm w-full bg-[var(--color-surface-800)] p-10 rounded-[2.5rem] border border-error/20 shadow-2xl">
          <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Error</h2>
          <p className="text-[var(--color-text-muted)] text-sm mb-8 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate('/carrito')}
            className="btn btn-primary w-full h-14 rounded-2xl font-bold"
          >
            Volver al Carrito
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-32 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/carrito')}
            className="btn btn-ghost btn-square rounded-2xl bg-[var(--color-surface-800)]"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Carrito Compartido</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Código de recuperación: <span className="text-primary font-bold">{code}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Info Banner */}
        <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl flex items-center gap-3">
          <CheckCircle size={18} className="text-primary" />
          <p className="text-xs font-medium text-[var(--color-text-muted)]">
            Este es un carrito compartido. Al continuar, se reemplazará su carrito actual con estos
            productos.
          </p>
        </div>

        {/* Cart Items List */}
        <div className="space-y-3">
          {sharedCart?.items.map((item, index) => (
            <div
              key={index}
              className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] p-4 flex flex-row items-center gap-4"
            >
              <div className="w-14 h-14 bg-[var(--color-surface-900)] rounded-xl flex items-center justify-center shrink-0 border border-[var(--color-border)]">
                <Package className="text-[var(--color-text-muted)] opacity-50" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm truncate">{item.name}</h4>
                <p className="text-xs text-[var(--color-text-muted)] font-medium">
                  {item.quantity} x {formatCurrency(item.price)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-primary">
                  {formatCurrency(item.price * item.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Card */}
        <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] shadow-2xl rounded-[2rem] overflow-hidden">
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                  Total del Carrito
                </p>
                <h3 className="text-4xl font-black tracking-tighter text-primary">
                  {formatCurrency(sharedCart?.total || 0)}
                </h3>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">
                  Items
                </p>
                <p className="text-lg font-bold">{sharedCart?.items.length}</p>
              </div>
            </div>

            <button
              onClick={handleContinueToCheckout}
              className="btn btn-primary btn-lg w-full rounded-2xl h-16 font-black text-lg shadow-lg shadow-primary/20"
            >
              Cargar y Continuar <ShoppingBag size={20} className="ml-2" />
            </button>

            <p className="text-[10px] text-center text-[var(--color-text-muted)] font-medium">
              Expira el {new Date(sharedCart?.expiresAt || '').toLocaleDateString('es-AR')} a las{' '}
              {new Date(sharedCart?.expiresAt || '').toLocaleTimeString('es-AR')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
