import { Eye, EyeOff, FileText } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { apiService } from '../services/apiService';
import type { Seller } from '../types';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (seller: Seller, pin: string) => void;
}

export function PinModal({ isOpen, onClose, onSuccess }: PinModalProps) {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);

  const handleValidate = async () => {
    if (!pin) return;
    setIsLoading(true);
    setError('');
    try {
      const seller = await apiService.loginSeller(pin);
      if (seller) {
        onSuccess(seller, pin);
        onClose();
      } else {
        setError('PIN incorrecto');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative bg-base-100 w-full max-w-xs p-8 shadow-2xl text-center space-y-6 border border-white/10"
          >
            <div className="w-16 h-16 bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <FileText size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold uppercase tracking-tight">PIN Vendedor</h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Ingrese su código para autorizar el acceso.
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  id="pinmodal-input"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  placeholder="••••••••"
                  maxLength={8}
                  className="w-full bg-[var(--color-surface-800)] p-4 text-center text-3xl tracking-[0.6rem] font-black focus:ring-2 focus:ring-primary outline-none"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                />
                <button
                  id="pinmodal-visibility-btn"
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[var(--color-text-muted)] hover:text-primary transition-colors"
                >
                  {showPin ? <EyeOff size={24} /> : <Eye size={24} />}
                </button>
              </div>

              {error && (
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest">{error}</p>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  id="pinmodal-cancel-btn"
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-[var(--color-surface-800)] font-bold text-sm"
                >
                  CANCELAR
                </button>
                <button
                  id="pinmodal-validate-btn"
                  type="button"
                  onClick={handleValidate}
                  disabled={isLoading || pin.length !== 8}
                  className="flex-1 py-3 bg-primary text-primary-content font-bold text-sm flex items-center justify-center"
                >
                  {isLoading ? '...' : 'VALIDAR'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
