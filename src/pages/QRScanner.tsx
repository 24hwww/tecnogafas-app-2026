import { type IDetectedBarcode, Scanner } from '@yudiel/react-qr-scanner';
import { ArrowLeft, CheckCircle, Scan, XCircle, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { cn } from '../lib/utils';
import type { CartItem } from '../types';

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
      console.log('QR Code detected:', rawValue);

      if (rawValue.includes('/shared-cart/')) {
        const parts = rawValue.split('/');
        const code = parts[parts.length - 1];
        if (code) {
          setScanning(false);
          setSuccess(true);
          setTimeout(() => navigate(`/shared-cart/${code}`), 1000);
          return;
        }
      }

      const data: QRData = JSON.parse(rawValue);
      if (!data.id || !data.items || !Array.isArray(data.items)) {
        throw new Error('Formato de QR inválido');
      }

      setScanning(false);
      setSuccess(true);
      clearCart();
      setCart(data.items);
      if (data.client) {
        setSelectedClient({
          id: 'qr-client',
          name: data.client.name,
          email: data.client.email || '',
          phone: '',
          address: '',
        });
      }
      setTimeout(() => navigate('/carrito'), 1500);
    } catch (err) {
      console.error('Error processing QR:', err);
      const rawValue = detectedCodes[0].rawValue;
      if (rawValue.includes('"items"') || rawValue.includes('/shared-cart/')) {
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

  return (
    <div className="flex flex-col min-h-[80vh] max-w-2xl mx-auto py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Escáner QR</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Carga pedidos automáticamente</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center bg-[var(--color-surface-800)] border border-primary/20 p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full"
            >
              <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={50} />
              </div>
              <h2 className="text-3xl font-black mb-2">¡Completado!</h2>
              <p className="text-[var(--color-text-muted)] leading-relaxed">
                El carrito ha sido cargado con éxito. Redirigiendo...
              </p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center bg-[var(--color-surface-800)] border border-error/20 p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full"
            >
              <div className="w-24 h-24 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle size={50} />
              </div>
              <h2 className="text-2xl font-bold mb-4 text-error">Error de Lectura</h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-8">{error}</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setError(null);
                    setScanning(true);
                  }}
                  className="btn btn-primary btn-lg rounded-2xl w-full h-14"
                >
                  Reintentar
                </button>
                <button onClick={() => navigate('/carrito')} className="btn btn-ghost text-sm">
                  Cancelar
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full space-y-8 flex flex-col items-center"
            >
              <div className="relative w-full max-w-sm group">
                {/* Decorative glow */}
                <div className="absolute -inset-1 bg-primary/20 rounded-[3rem] blur-xl group-hover:bg-primary/30 transition-all opacity-50"></div>

                <div className="relative bg-[var(--color-surface-800)] border-4 border-[var(--color-border)] rounded-[2.5rem] overflow-hidden aspect-square shadow-2xl flex items-center justify-center">
                  {scanning && (
                    <Scanner
                      // @ts-expect-error Types mismatch with React 19
                      onScan={handleScan}
                      onError={handleError}
                      components={{ audio: false, finder: true }}
                      styles={{ container: { width: '100%', height: '100%' } }}
                    />
                  )}

                  {/* Scan overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-primary/40 rounded-3xl relative">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl"></div>

                      {/* Scanning line animation */}
                      <div className="w-full h-0.5 bg-primary/50 shadow-[0_0_15px_rgba(16,185,129,0.5)] absolute top-0 animate-[scan_2s_infinite_linear]"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--color-surface-800)] p-6 rounded-3xl border border-[var(--color-border)] flex items-start gap-4 max-w-sm">
                <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0">
                  <Zap size={20} />
                </div>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed font-medium">
                  Escanee el código QR del PDF impreso o desde la pantalla de otro dispositivo para
                  sincronizar instantáneamente el carrito de compras.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `,
        }}
      />
    </div>
  );
}
