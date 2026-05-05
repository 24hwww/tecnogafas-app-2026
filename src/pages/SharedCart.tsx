import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingBag, AlertCircle, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { SharedCart } from '../types';
import { useApp } from '../AppContext';

export default function SharedCart() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [cart, setCart] = useState<SharedCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSharedCart = async () => {
      try {
        const { supabase } = await import('../modules/chat/lib/supabase');
        const { data, error } = await supabase
          .from('shared_carts')
          .select('*')
          .eq('code', code)
          .eq('is_active', true)
          .single();

        if (error || !data) {
          setError('Carrito no encontrado o expirado');
          return;
        }

        // Check if expired
        if (new Date(data.expires_at) < new Date()) {
          setError('Este carrito ha expirado');
          return;
        }

        setCart(data);
        setError(null);
      } catch (err) {
        console.error('Error loading shared cart:', err);
        setError('Error al cargar el carrito compartido');
      } finally {
        setLoading(false);
      }
    };

    loadSharedCart();
  }, [code]);

  const { loadSharedCart, addToCart, setSelectedClient, clearCart } = useApp();

  const handleContinueToCheckout = async () => {
    if (!cart) return;
    
    try {
      const result = await loadSharedCart(cart.code);
      
      if (result.success && result.cart) {
        // Set client in context
        if (result.cart.client) {
          setSelectedClient(result.cart.client);
        }
        
        // Clear existing cart and add shared items
        clearCart();
        
        result.cart.items.forEach(item => {
          addToCart(
            {
              id: item.product_id.toString(),
              name: item.name,
              category: '',
              price: item.price,
              stock: item.quantity,
              image: '',
              description: '',
              variations: item.vid ? [{
                vid: item.vid?.toString() || '',
                title: item.variation_name || '',
                stock: item.quantity,
                price: item.price
              }] : undefined
            },
            item.quantity
          );
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full border-2 border-primary/20 border-t-primary/20 h-8 w-8"></div>
          <p className="mt-4 text-sm text-gray-600">Cargando carrito compartido...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-4 p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <AlertCircle size={48} className="text-red-500 mr-3" />
              <h2 className="text-xl font-bold text-red-800">Error</h2>
            </div>
            <p className="text-red-600">{error}</p>
            <button 
              onClick={() => navigate('/carrito')}
              className="w-full m3-button-filled mt-4"
            >
              Volver al Carrito
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!cart) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag size={48} className="text-gray-400 mb-4" />
          <p className="text-gray-600">Carrito no encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Carrito Compartido</h1>
            <button 
              onClick={() => navigate('/carrito')}
              className="flex items-center text-primary hover:text-primary/80 transition-colors"
            >
              <ArrowLeft size={20} className="mr-2" />
              Volver
            </button>
          </div>
        </div>
      </div>

      {/* Cart Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Carrito: <span className="text-primary">{code}</span>
              </h2>
              <div className="text-sm text-gray-600">
                Expira en 24 horas
              </div>
            </div>

            {/* Client Info */}
            {cart.client && (
              <div className="m3-card !bg-primary-container/20 border-primary/20">
                <h3 className="text-xs font-bold text-primary flex items-center gap-1 mb-2">
                  CLIENTE ASOCIADO
                </h3>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold">{cart.client.name}</p>
                    <p className="text-xs text-on-surface-variant">{cart.client.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Cart Items */}
            <div className="space-y-3">
              {cart.items.map((item, index) => (
                <div key={index} className="m3-card flex gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{item.name}</h4>
                    <p className="text-xs text-on-surface-variant">{formatCurrency(item.price)} c/u</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center bg-surface px-2 py-1 border border-outline/10">
                        <span className="mx-3 font-bold text-xs">{item.quantity}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col justify-between items-end">
                    <span className="font-bold text-primary">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="m3-card !bg-surface sticky bottom-0 border-t-2 border-primary/10 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.3)] -mx-4 px-4 py-6 space-y-4 z-10">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Total</span>
                <span className="text-2xl font-bold text-primary">{formatCurrency(cart.total)}</span>
              </div>
              <button 
                onClick={handleContinueToCheckout}
                className="w-full m3-button-filled py-3"
              >
                Continuar al Checkout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
