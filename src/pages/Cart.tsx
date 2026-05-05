import { useApp } from '../AppContext';
import { Trash2, AlertCircle, ShoppingBag, User, Share2, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';
import { useState } from 'react';

export default function Cart() {
  const { cart, selectedClient, removeFromCart, updateCartQuantity, shareCart } = useApp();
  const navigate = useNavigate();
  const [isSharing, setIsSharing] = useState(false);
  const [shareResult, setShareResult] = useState<{ success: boolean; code: string; message: string; link: string } | null>(null);

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleConfirm = () => {
    navigate('/pago');
  };

  const handleShareCart = async () => {
    if (!selectedClient || cart.length === 0) {
      alert('Debes tener productos en el carrito y un cliente asignado para compartir');
      return;
    }

    setIsSharing(true);
    try {
      const result = await shareCart();
      setShareResult(result);
      
      if (result.success) {
        // Copy link to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(result.link);
          alert('¡Carrito compartido! El enlace ha sido copiado al portapapeles.');
        }

        // Try native share API
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Carrito Tecnogafas',
              text: `Mira mi carrito: ${result.link}`,
              url: result.link
            });
          } catch (shareError) {
            console.log('Native share failed:', shareError);
          }
        }
      }
    } catch (error) {
      console.error('Error sharing cart:', error);
      setShareResult({ success: false, code: '', message: 'Error al compartir carrito', link: '' });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <h2 id="cart-title" className="text-2xl font-bold">Carrito</h2>

      {/* Selected Client Section */}
      <div className="m3-card !bg-primary-container/20 border-primary/20">
        <h3 className="text-xs font-bold text-primary flex items-center gap-1 mb-2">
          <User size={14} /> CLIENTE ASOCIADO
        </h3>
        {selectedClient ? (
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold">{selectedClient.name}</p>
              <p className="text-xs text-on-surface-variant">{selectedClient.email}</p>
            </div>
            <button id="cart-change-client-btn" onClick={() => navigate('/clientes')} className="text-xs text-primary font-bold">Cambiar</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle size={20} />
              <span className="text-xs font-medium">Asigna un cliente para continuar</span>
            </div>
            <button id="cart-assign-client-btn" onClick={() => navigate('/clientes')} className="m3-button-filled w-full">Asignar</button>
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div className="space-y-3">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 border-2 border-dashed border-outline/20 rounded-2xl">
            <div className="bg-surface-variant p-4 rounded-full">
              <ShoppingBag size={48} className="text-outline" />
            </div>
            <h3 className="font-bold">Carrito Vacío</h3>
            <p className="text-xs text-on-surface-variant">Agrega productos del catálogo para comenzar un pedido.</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="m3-card flex gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm">{item.name}</h4>
                <p className="text-xs text-on-surface-variant">{formatCurrency(item.price)} c/u</p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center bg-surface px-2 py-1 border border-outline/10">
                    <button id={`cart-decrease-qty-btn-${item.id}`} onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="p-1">
                      <span className="text-lg font-bold">−</span>
                    </button>
                    <span className="mx-3 font-bold text-xs">{item.quantity}</span>
                    <button id={`cart-increase-qty-btn-${item.id}`} onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="p-1">
                      <span className="text-lg font-bold">+</span>
                    </button>
                  </div>
                  <button id={`cart-remove-item-btn-${item.id}`} onClick={() => removeFromCart(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="text-right flex flex-col justify-between items-end">
                <span className="font-bold text-primary">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        id="cart-add-products-btn"
        onClick={() => navigate('/productos')}
        className="w-full text-center text-sm font-bold text-primary py-4 border-2 border-primary border-dashed rounded-xl hover:bg-primary/5 transition-colors"
      >
        + Agregar {cart.length === 0 ? 'productos' : 'más productos'}
      </button>

      {/* Share Result Modal */}
      {shareResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold mb-4">
              {shareResult.success ? '✅ ¡Carrito Compartido!' : '❌ Error al Compartir'}
            </h3>
            {shareResult.success ? (
              <div className="space-y-3">
                <p className="text-green-600 font-medium">{shareResult.message}</p>
                <div className="bg-gray-100 p-3 rounded border">
                  <p className="text-sm font-bold mb-2">Código del carrito:</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-200 px-3 py-2 rounded font-mono text-lg">{shareResult.code}</code>
                    <button 
                      onClick={() => navigator.clipboard.writeText(shareResult.link)}
                      className="m3-button-outlined text-sm"
                    >
                      <Copy size={16} className="mr-1" />
                      Copiar
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Enlace público: <a href={shareResult.link} target="_blank" className="text-blue-600 underline">{shareResult.link}</a>
                </p>
                <p className="text-xs text-gray-500">Este enlace expirará en 24 horas.</p>
              </div>
              <button 
                onClick={() => setShareResult(null)}
                className="w-full m3-button-filled mt-4"
              >
                Cerrar
              </button>
            </div>
            ) : (
              <div className="space-y-3">
                <p className="text-red-600 font-medium">{shareResult.message}</p>
                <button 
                  onClick={() => setShareResult(null)}
                  className="w-full m3-button-filled mt-4"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary and Action */}
      <div className="m3-card !bg-surface sticky bottom-0 border-t-2 border-primary/10 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.3)] -mx-4 px-4 py-6 space-y-4 z-10">
        <div className="flex justify-between items-center">
          <span className="text-lg font-medium">Total</span>
          <span className="text-2xl font-bold text-primary">{formatCurrency(total)}</span>
        </div>
        <div className="space-y-3">
          <button 
            id="cart-share-cart-btn"
            onClick={handleShareCart}
            disabled={!selectedClient || cart.length === 0 || isSharing}
            className="w-full m3-button-outlined py-3 disabled:opacity-50"
          >
            {isSharing ? (
              <>
                <div className="inline-block animate-spin rounded-full border-2 border-primary/20 border-t-primary/20 h-4 w-4 mr-2"></div>
                Guardando y Compartiendo...
              </>
            ) : (
              <>
                <Share2 size={18} className="mr-2" />
                Guardar y Compartir Carrito
              </>
            )}
          </button>
          <button 
            id="cart-confirm-order-btn"
            onClick={handleConfirm}
            disabled={!selectedClient || cart.length === 0}
            className="w-full m3-button-filled py-3 disabled:opacity-50"
          >
            Confirmar Pedido
          </button>
        </div>
      </div>
    </div>
  );
}
