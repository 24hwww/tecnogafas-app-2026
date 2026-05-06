import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { CartItem } from '../types';

interface QRData {
  id: string;
  client?: { name: string; email?: string };
  items: CartItem[];
  total: number;
  date: string;
  version: string;
}

export default function QRScanner() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<QRData | null>(null);
  
  const navigate = useNavigate();
  const { setCart, setSelectedClient, clearCart } = useApp();

  useEffect(() => {
    const qrId = searchParams.get('id');
    
    if (!qrId) {
      setError('No se proporcionó un código QR');
      setIsLoading(false);
      return;
    }

    try {
      // En una implementación real, esto vendría de una API o base de datos
      // Por ahora, simulamos la recuperación desde localStorage o Supabase
      const storedData = localStorage.getItem(`qr_cart_${qrId}`);
      
      if (storedData) {
        const data: QRData = JSON.parse(storedData);
        setQrData(data);
        
        // Limpiar carrito existente y cargar nuevo
        clearCart();
        setCart(data.items);
        if (data.client) {
          setSelectedClient(data.client);
        }
        
        setIsLoading(false);
      } else {
        setError('Código QR no encontrado o expirado');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error loading QR data:', err);
      setError('Error al procesar el código QR');
      setIsLoading(false);
    }
  }, [searchParams, setCart, setSelectedClient, clearCart]);

  const handleContinueToCheckout = () => {
    if (qrData) {
      // Limpiar el QR usado
      localStorage.removeItem(`qr_cart_${qrData.id}`);
      
      // Navegar al checkout
      navigate('/carrito');
    }
  };

  const handleGoToCart = () => {
    navigate('/carrito');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full border-4 border-primary/20 border-t-primary/20 h-12 w-12"></div>
          <p className="mt-4 text-on-surface">Cargando carrito...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="text-center m3-card p-6 max-w-sm">
          <h2 className="text-xl font-bold text-error mb-4">❌ Error</h2>
          <p className="text-on-surface mb-6">{error}</p>
          <button 
            onClick={handleGoToCart}
            className="m3-button-filled w-full"
          >
            Ir al Carrito
          </button>
        </div>
      </div>
    );
  }

  if (!qrData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="text-center m3-card p-6 max-w-md w-full">
        <div className="mb-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🛒</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface mb-2">¡Carrito Recuperado!</h1>
          <p className="text-on-surface-variant">El carrito ha sido cargado exitosamente</p>
        </div>

        {qrData.client && (
          <div className="mb-6 p-4 bg-primary-container/20 border border-primary/20 rounded-lg">
            <h2 className="text-lg font-bold text-primary mb-2">👤 Cliente</h2>
            <p className="font-medium text-on-surface">{qrData.client.name}</p>
            {qrData.client.email && (
              <p className="text-sm text-on-surface-variant">{qrData.client.email}</p>
            )}
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-lg font-bold text-on-surface mb-3">📦 Productos ({qrData.items.length})</h2>
          <div className="space-y-2">
            {qrData.items.map((item: CartItem, index: number) => (
              <div key={index} className="flex justify-between items-center p-3 bg-surface-variant rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-on-surface">{item.name}</p>
                  <p className="text-sm text-on-surface-variant">
                    ${item.price ? `$${item.price} c/u × ${item.quantity}` : `${item.quantity} unidades`}
                  </p>
                </div>
                <p className="font-bold text-primary">
                  ${item.price ? `$${(item.price * item.quantity).toFixed(2)}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center p-4 bg-surface-variant rounded-lg">
          <p className="text-lg font-bold text-on-surface mb-2">
            💰 Total: ${qrData.total.toFixed(2)}
          </p>
          <p className="text-sm text-on-surface-variant mb-4">
            Fecha: {new Date(qrData.date).toLocaleDateString('es-AR')}
          </p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={handleGoToCart}
            className="flex-1 m3-button-outlined"
          >
            Ver Carrito
          </button>
          <button 
            onClick={handleContinueToCheckout}
            className="flex-1 m3-button-filled"
          >
            Ir a Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
