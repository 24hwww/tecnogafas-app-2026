import {
  Bell,
  Eye,
  EyeOff,
  Key,
  Moon,
  Palette,
  RefreshCw,
  Settings as SettingsIcon,
  Smartphone,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
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
      alert(
        'PIN guardado. La sincronización en segundo plano y las notificaciones están activadas.',
      );
      kodular.send('PIN_CHANGED', { pin: pinInput });
    } else {
      setGlobalPin(null);
      setPinInput('');
      alert('PIN eliminado. Sincronización desactivada.');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10 max-w-2xl">
      <h2 id="settings-title" className="text-2xl font-bold flex items-center gap-3">
        <SettingsIcon className="text-primary" size={24} /> Configuraciones
      </h2>

      <div className="space-y-6">
        {/* Cuenta y Sincronización */}
        <section className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Key size={18} className="opacity-50" /> Cuenta
          </h3>
          <div className="card bg-base-100 shadow-sm border border-base-300/40">
            <div className="card-body space-y-4">
              <p className="text-sm opacity-60">
                Ingresa tu PIN de vendedor para activar la sincronización en segundo plano y recibir
                notificaciones.
              </p>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    id="settings-pin-input"
                    type={showPin ? 'text' : 'password'}
                    placeholder="PIN de 8 dígitos"
                    className="input input-bordered w-full font-mono tracking-widest text-lg pr-12 bg-base-200/50"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  />
                  <button
                    id="settings-toggle-pin-visibility-btn"
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-square btn-sm"
                  >
                    {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button
                  id="settings-save-pin-btn"
                  type="button"
                  onClick={handleSavePin}
                  className="btn btn-primary w-full"
                >
                  {globalPin ? 'Actualizar PIN' : 'Vincular Cuenta'}
                </button>
              </div>
              {globalPin && (
                <div className="alert alert-success py-2">
                  <RefreshCw size={14} className="animate-spin" />
                  <span className="text-xs font-semibold">Sincronización en tiempo real activa</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Notificaciones */}
        <section className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell size={18} className="opacity-50" /> Notificaciones
          </h3>
          <div className="card bg-base-100 shadow-sm border border-base-300/40">
            <div className="card-body">
              <button
                id="settings-enable-notifications-btn"
                type="button"
                onClick={enablePush}
                disabled={pushEnabled}
                className={cn(
                  'btn w-full gap-3',
                  pushEnabled ? 'btn-success' : 'btn-outline',
                )}
              >
                <Bell size={18} />
                {pushEnabled ? 'Notificaciones Push Activadas' : 'Habilitar Notificaciones'}
              </button>
            </div>
          </div>
        </section>

        {/* Apariencia */}
        <section className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Palette size={18} className="opacity-50" /> Apariencia
          </h3>
          <div className="card bg-base-100 shadow-sm border border-base-300/40">
            <div className="card-body space-y-6">
              {/* Theme toggle */}
              <div>
                <p className="text-sm font-semibold mb-3">Modo de Pantalla</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={cn(
                      'btn gap-2 flex-col h-auto py-4',
                      theme === 'light' ? 'btn-primary' : 'btn-ghost',
                    )}
                  >
                    <Sun size={20} />
                    <span className="text-xs font-semibold">Claro</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={cn(
                      'btn gap-2 flex-col h-auto py-4',
                      theme === 'dark' ? 'btn-primary' : 'btn-ghost',
                    )}
                  >
                    <Moon size={20} />
                    <span className="text-xs font-semibold">Oscuro</span>
                  </button>
                </div>
              </div>

              {/* Accent color */}
              <div>
                <p className="text-sm font-semibold mb-3">Color de Énfasis</p>
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full shadow-inner relative overflow-hidden border-2 border-base-300 shrink-0 cursor-pointer"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <input
                      id="settings-primary-color-input"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{primaryColor.toUpperCase()}</p>
                    <p className="text-xs opacity-50">
                      Personaliza el color de botones y detalles.
                    </p>
                  </div>
                </div>
              </div>

              {/* Font size */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-semibold">Tamaño de Texto</p>
                  <span className="badge badge-primary badge-sm">
                    {Math.round((((parseInt(fontSize) || 16) - 16) / 12) * 100)}%
                  </span>
                </div>
                <input
                  id="settings-font-size-input"
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round((((parseInt(fontSize) || 16) - 16) / 12) * 100)}
                  onChange={(e) => {
                    const percentage = parseInt(e.target.value);
                    const newSize = 16 + (percentage / 100) * 12;
                    setFontSize(`${newSize}px`);
                  }}
                  className="range range-primary range-sm w-full"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Sistema */}
        <section className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Smartphone size={18} className="opacity-50" /> Sistema
          </h3>
          <div className="card bg-base-100 shadow-sm border border-base-300/40">
            <div className="card-body">
              {kodular.isKodular ? (
                <div className="space-y-4">
                  <div className="alert alert-success">
                    <Sparkles size={16} />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider">
                        Interfaz Kodular Activa
                      </p>
                      <p className="text-xs opacity-70 mt-0.5">
                        Soporte completo para QR, Notificaciones Nativas, Huella Digital y
                        Almacenamiento Seguro.
                      </p>
                    </div>
                  </div>
                  <button
                    id="settings-test-vibrate-btn"
                    type="button"
                    onClick={() => {
                      kodular.vibrate(100);
                      kodular.notify('Prueba de Sistema', 'Conexión con el puente Kodular exitosa.');
                    }}
                    className="btn btn-secondary w-full gap-2"
                  >
                    <RefreshCw size={16} /> Probar Puente Nativo
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center py-6 space-y-2">
                  <Smartphone className="opacity-20" size={36} />
                  <p className="text-sm italic opacity-60">Ejecutando en entorno Web Estándar</p>
                  <p className="text-xs opacity-40 px-4">
                    Las funciones nativas de Android (vibración, persistencia de bajo nivel) no están
                    disponibles.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
