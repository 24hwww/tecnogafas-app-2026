import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ', r);
      // Opcionalmente podemos verificar por actualizaciones cada X tiempo (e.g. 1 min)
      if (r) {
         setInterval(() => {
           r.update();
         }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <AnimatePresence>
      {(needRefresh || offlineReady) && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="fixed bottom-20 left-4 right-4 z-50 flex items-center justify-center pointer-events-none"
        >
          <div className="bg-surface m3-card border border-primary/20 shadow-2xl p-4 flex flex-col gap-3 pointer-events-auto max-w-sm w-full">
            <div className="flex items-start justify-between">
              <div>
                <h4 id="update-prompt-title" className="font-bold text-sm">
                  {needRefresh ? "¡Nueva actualización!" : "App lista"}
                </h4>
                <p className="text-xs text-on-surface-variant mt-1">
                  {needRefresh 
                    ? "Hay una nueva versión de la app disponible." 
                    : "La aplicación está lista para funcionar sin conexión."}
                </p>
              </div>
              <button 
                id="update-prompt-close-btn"
                onClick={close} 
                className="p-1 hover:bg-surface-variant rounded-full text-outline"
              >
                <X size={16} />
              </button>
            </div>
            
            {needRefresh && (
              <button
                id="update-prompt-update-btn"
                onClick={() => updateServiceWorker(true)}
                className="m3-button-filled w-full font-bold text-xs py-2.5 flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} className="animate-spin" />
                Actualizar ahora
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
