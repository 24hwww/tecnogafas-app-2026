import { useCart } from '../contexts/CartContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartItem } from '../types';
import { Scanner, IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';

interface QRData {
  id: string;
  client?: { name: string; email?: string };
  items: CartItem[];
  total: number;
  date: string;
  version: string;
}

export default function QRScanner() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(true);
  
  const navigate = useNavigate();
  const { setCart, setSelectedClient, clearCart } = useCart();

  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (!scanning || detectedCodes.length === 0) return;
    
    try {
      const rawValue = detectedCodes[0].rawValue;
      const data: QRData = JSON.parse(rawValue);
      
      // Basic validation
      if (!data.id || !data.items || !Array.isArray(data.items)) {
        throw new Error("Formato de QR inválido");
      }

      setScanning(false);
      setSuccess(true);
      
      // Load into cart
      clearCart();
      setCart(data.items);
      if (data.client) {
        setSelectedClient({
          id: 'qr-client',
          name: data.client.name,
          email: data.client.email || '',
          phone: '',
          address: ''
        });
      }
      
      // Navigate to cart after short delay
      setTimeout(() => {
        navigate('/carrito');
      }, 1500);
      
    } catch (err) {
      console.error('Error procesando el código QR:', err);
      // Solo mostramos error si intentó parsear un JSON válido pero falló
      // o si es un QR que no es nuestro (para evitar spam de errores al pasar cámara por otros QR)
      if (detectedCodes[0].rawValue.includes('"items"')) {
         setError('Error al leer los datos del carrito del código QR.');
         setScanning(false);
      }
    }
  };

  const handleError = (err: unknown) => {
    console.error('QR Scanner error:', err);
    setError('No se pudo acceder a la cámara. Verifique los permisos.');
    setScanning(false);
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={handleGoBack} className="p-2 bg-surface-variant rounded-full text-on-surface hover:bg-surface-variant-hover transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-on-surface">Escanear Carrito</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {success ? (
          <div className="text-center m3-card p-6 w-full max-w-sm animate-in fade-in zoom-in duration-300">
            <CheckCircle className="w-20 h-20 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-on-surface mb-2">¡Éxito!</h2>
            <p className="text-on-surface-variant">Carrito cargado correctamente. Redirigiendo...</p>
          </div>
        ) : error ? (
          <div className="text-center m3-card p-6 w-full max-w-sm">
            <XCircle className="w-20 h-20 text-error mx-auto mb-4" />
            <h2 className="text-xl font-bold text-error mb-4">Error</h2>
            <p className="text-on-surface mb-6">{error}</p>
            <button 
              onClick={() => { setError(null); setScanning(true); }}
              className="m3-button-filled w-full mb-3 py-3"
            >
              Reintentar
            </button>
            <button 
              onClick={() => navigate('/carrito')}
              className="m3-button-outlined w-full py-3"
            >
              Ir al Carrito
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md">
            <div className="m3-card overflow-hidden p-2 bg-surface-variant shadow-lg border-2 border-primary/20">
              <div className="rounded-xl overflow-hidden aspect-square relative bg-black/5 flex items-center justify-center">
                 {scanning && (
                   // @ts-ignore - La librería tiene un desajuste de tipos con React 19 en su definición de JSX
                   <Scanner 
                     onScan={handleScan}
                     onError={handleError}
                     components={{
                       audio: false,
                       finder: true,
                     }}
                   />
                 )}
                 <div className="absolute inset-0 pointer-events-none border-4 border-primary/50 rounded-xl z-10"></div>
              </div>
            </div>
            <p className="text-center text-on-surface-variant mt-6 text-sm font-medium">
              Apunta la cámara al código QR generado en el PDF del pedido para cargar los datos automáticamente al carrito.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
