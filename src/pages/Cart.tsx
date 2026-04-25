import { useApp } from '../AppContext';
import { Trash2, AlertCircle, ShoppingBag, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';

export default function Cart() {
  const { cart, selectedClient, removeFromCart, updateCartQuantity } = useApp();
  const navigate = useNavigate();

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleConfirm = () => {
    navigate('/pago');
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 pt-20">
        <div className="bg-surface-variant p-6 rounded-full">
          <ShoppingBag size={64} className="text-outline" />
        </div>
        <h3 className="text-xl font-bold">Carrito Vacío</h3>
        <p className="text-sm text-on-surface-variant">Agrega productos del catálogo para comenzar un pedido.</p>
        <button onClick={() => navigate('/productos')} className="m3-button-tonal">Ir al Catálogo</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Carrito de Pedido</h2>

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
            <button onClick={() => navigate('/clientes')} className="text-xs text-primary font-bold">Cambiar</button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle size={20} />
              <span className="text-xs font-medium">Asigna un cliente para continuar</span>
            </div>
            <button onClick={() => navigate('/clientes')} className="m3-button-filled !px-3 !py-1 text-xs">Asignar</button>
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div className="space-y-3">
        {cart.map((item) => (
          <div key={item.id} className="m3-card flex gap-4">
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{item.name}</h4>
              <p className="text-xs text-on-surface-variant">{formatCurrency(item.price)} c/u</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center bg-surface px-2 py-1 border border-outline/10">
                  <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="p-1">
                    <span className="text-lg font-bold">−</span>
                  </button>
                  <span className="mx-3 font-bold text-xs">{item.quantity}</span>
                  <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="p-1">
                    <span className="text-lg font-bold">+</span>
                  </button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <div className="text-right flex flex-col justify-between items-end">
              <span className="font-bold text-primary">{formatCurrency(item.price * item.quantity)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary and Action */}
      <div className="m3-card !bg-surface sticky bottom-0 border-t-2 border-primary/10 shadow-lg -mx-4 px-4 py-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-medium">Total</span>
          <span className="text-2xl font-bold text-primary">{formatCurrency(total)}</span>
        </div>
        <button 
          onClick={handleConfirm}
          disabled={!selectedClient}
          className="w-full m3-button-filled py-3 disabled:opacity-50"
        >
          Confirmar Pedido
        </button>
      </div>
    </div>
  );
}
