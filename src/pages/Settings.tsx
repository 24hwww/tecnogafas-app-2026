import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { Settings as SettingsIcon, Bell, RefreshCw, Key, Eye, EyeOff, Smartphone, Palette, Sun, Moon, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { kodular } from '../lib/kodularBridge';
import { cn } from '../lib/utils';

export default function Settings() {
  const { primaryColor, fontSize, theme, setPrimaryColor, setFontSize, setTheme } = useUI();
  const { globalPin, setGlobalPin } = useAuth();
  const [pinInput, setPinInput] = useState(globalPin || '');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  const enablePush = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      alert('Tu navegador no soporta notificaciones push');
      return;
    }
    const perm = await Notification.requestPermission();
    setPushEnabled(perm === 'granted');
  };

  const handleSavePin = () => {
    if (pinInput.length === 8) {
      setGlobalPin(pinInput);
      alert('PIN guardado. La sincronización en segundo plano y las notificaciones están activadas.');
      kodular.send('PIN_CHANGED', { pin: pinInput });
    } else {
      setGlobalPin(null);
      setPinInput('');
      alert('PIN eliminado. Sincronización desactivada.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <h2 id="settings-title" className="text-h2 flex items-center gap-3">
        <SettingsIcon className="text-primary" /> Configuraciones
      </h2>
      
      <div className="space-y-6">
        {/* Cuenta y Sincronización */}
        <section className="space-y-4">
          <h3 className="text-h3 flex items-center gap-2"><Key size={20} className="text-on-surface-variant"/> Cuenta</h3>
          <div className="m3-card space-y-4">
            <p className="text-body-sm">Ingresa tu PIN de vendedor para activar la sincronización en segundo plano y recibir notificaciones.</p>
            <div className="space-y-3">
              <div className="relative">
                <input 
                  id="settings-pin-input"
                  type={showPin ? "text" : "password"} 
                  placeholder="PIN de 8 dígitos"
                  className="m3-input w-full font-mono tracking-widest text-lg pr-12"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                />
                <button
                  id="settings-toggle-pin-visibility-btn"
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-on-surface-variant hover:text-primary transition-colors"
                >
                  {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <button 
                id="settings-save-pin-btn"
                onClick={handleSavePin}
                className="m3-button-filled w-full"
              >
                {globalPin ? 'Actualizar PIN' : 'Vincular Cuenta'}
              </button>
            </div>
            {globalPin && (
               <div className="flex items-center gap-2 px-3 py-2 bg-success/10 text-success rounded-xl text-[0.7rem] font-bold">
                 <RefreshCw size={14} className="animate-spin" />
                 Sincronización en tiempo real activa
               </div>
            )}
          </div>
        </section>

        {/* Notificaciones */}
        <section className="space-y-4">
          <h3 className="text-h3 flex items-center gap-2"><Bell size={20} className="text-on-surface-variant"/> Notificaciones</h3>
          <div className="m3-card">
            <button 
              id="settings-enable-notifications-btn"
              onClick={enablePush}
              disabled={pushEnabled}
              className={cn(
                "w-full p-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3",
                pushEnabled 
                  ? "bg-success/10 text-success border border-success/20" 
                  : "bg-surface-variant text-on-surface-variant hover:bg-outline/10"
              )}
            >
              <Bell size={18} />
              {pushEnabled ? 'Notificaciones Push Activadas' : 'Habilitar Notificaciones'}
            </button>
          </div>
        </section>

        {/* Apariencia */}
        <section className="space-y-4">
          <h3 className="text-h3 flex items-center gap-2"><Palette size={20} className="text-on-surface-variant"/> Apariencia</h3>
          <div className="m3-card space-y-6">
            <div>
              <p className="text-label mb-3">Modo de Pantalla</p>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setTheme('light')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                    theme === 'light' ? "bg-primary-container border-primary text-on-primary-container" : "bg-surface-variant/30 border-outline/10 text-on-surface-variant"
                  )}
                >
                  <Sun size={20} />
                  <span className="text-xs font-bold">Claro</span>
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                    theme === 'dark' ? "bg-primary-container border-primary text-on-primary-container" : "bg-surface-variant/30 border-outline/10 text-on-surface-variant"
                  )}
                >
                  <Moon size={20} />
                  <span className="text-xs font-bold">Oscuro</span>
                </button>
              </div>
            </div>

            <div>
              <p className="text-label mb-3">Color de Énfasis</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full shadow-inner relative overflow-hidden border-2 border-outline/20 shrink-0" style={{ backgroundColor: primaryColor }}>
                  <input 
                    id="settings-primary-color-input"
                    type="color" 
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-on-surface">{primaryColor.toUpperCase()}</p>
                  <p className="text-[0.65rem] text-on-surface-variant">Personaliza el color de botones y detalles.</p>
                </div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-label">Tamaño de Texto</p>
                <span className="text-xs font-bold text-primary">{Math.round(((parseInt(fontSize) || 16) - 16) / 12 * 100)}%</span>
              </div>
              <input 
                id="settings-font-size-input"
                type="range" 
                min="0" 
                max="100" 
                value={Math.round(((parseInt(fontSize) || 16) - 16) / 12 * 100)}
                onChange={(e) => {
                  const percentage = parseInt(e.target.value);
                  const newSize = 16 + (percentage / 100) * 12;
                  setFontSize(`${newSize}px`);
                }}
                className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        </section>

        {/* Entorno */}
        <section className="space-y-4">
          <h3 className="text-h3 flex items-center gap-2"><Smartphone size={20} className="text-on-surface-variant"/> Sistema</h3>
          <div className="m3-card">
            {kodular.isKodular ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-success/10 rounded-xl border border-success/20">
                  <Sparkles className="text-success shrink-0" size={18} />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-success uppercase tracking-wider">Interfaz Kodular Activa</p>
                    <p className="text-[0.65rem] text-on-surface-variant mt-1 leading-relaxed">
                      Soporte completo para QR, Notificaciones Nativas, Huella Digital y Almacenamiento Seguro.
                    </p>
                  </div>
                </div>
                <button 
                  id="settings-test-vibrate-btn"
                  onClick={() => {
                    kodular.vibrate(100);
                    kodular.notify('Prueba de Sistema', 'Conexión con el puente Kodular exitosa.');
                  }}
                  className="m3-button-tonal w-full !py-3"
                >
                  <RefreshCw size={16} /> Probar Puente Nativo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center py-4 space-y-2">
                <Smartphone className="text-on-surface-variant/30" size={32} />
                <p className="text-body-sm italic">Ejecutando en entorno Web Estándar</p>
                <p className="text-[0.65rem] text-on-surface-variant px-4">
                  Las funciones nativas de Android (vibración, persistencia de bajo nivel) no están disponibles.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
