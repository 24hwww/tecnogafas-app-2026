import { useApp } from '../AppContext';
import { Settings as SettingsIcon, Bell, RefreshCw, Key } from 'lucide-react';
import { useState, useEffect } from 'react';
import { kodular } from '../lib/kodular';

export default function Settings() {
  const { primaryColor, fontSize, globalPin, setPrimaryColor, setFontSize, setGlobalPin } = useApp();
  const [pinInput, setPinInput] = useState(globalPin || '');
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
      if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
      }
    }
  }, []);

  const enablePush = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      alert('Tu navegador no soporta notificaciones push');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      try {
        await navigator.serviceWorker.register('/sw.js');
        setPushEnabled(true);
      } catch (err) {
        console.error('Error registrando service worker:', err);
      }
    } else {
      setPushEnabled(false);
    }
  };

  const handleSavePin = () => {
    if (pinInput.length === 8) {
      setGlobalPin(pinInput);
      alert('PIN guardado. La sincronización en segundo plano y las notificaciones están activadas.');
      
      // Notify Kodular if available
      kodular.call('onPinChanged', pinInput);
    } else {
      setGlobalPin(null);
      setPinInput('');
      alert('PIN eliminado. Sincronización desactivada.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <SettingsIcon /> Configuraciones
      </h2>
      
      <div className="m3-card space-y-6">
        <div>
          <h3 className="font-bold mb-4 flex items-center gap-2"><Key size={18}/> Cuenta y Sincronización</h3>
          <p className="text-sm text-outline mb-2">Ingresa tu PIN de vendedor para activar la sincronización en segundo plano (pedidos offline) y recibir notificaciones push de sistema.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input 
              type="password" 
              placeholder="PIN numérico de 8 dígitos"
              className="m3-input flex-1 font-mono tracking-widest text-lg"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
            />
            <button 
              onClick={handleSavePin}
              className="m3-button-filled"
            >
              {globalPin ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
          {globalPin && (
             <p className="text-xs text-green-600 font-bold mt-2 flex items-center gap-1"><RefreshCw size={14} className="animate-spin-slow"/> Sincronización Activa</p>
          )}
        </div>

        <hr className="border-outline/10"/>

        <div>
          <h3 className="font-bold mb-4 flex items-center gap-2"><Bell size={18}/> Notificaciones</h3>
          <button 
            onClick={enablePush}
            disabled={pushEnabled}
            className={`w-full p-3 font-bold rounded-xl transition ${pushEnabled ? 'bg-green-100 text-green-700' : 'bg-surface-variant hover:bg-outline/10'}`}
          >
            {pushEnabled ? 'Notificaciones Push Activadas' : 'Permitir Notificaciones Push'}
          </button>
        </div>

        <hr className="border-outline/10"/>

        <div>
          <h3 className="font-bold mb-4 flex items-center gap-2"><SettingsIcon size={18}/> Componentes Kodular</h3>
          {kodular.isAvailable() ? (
            <div className="p-4 bg-green-100/50 rounded-xl border border-green-200">
              <p className="text-sm font-bold text-green-800">✅ Interfaz Kodular Detectada</p>
              <ul className="text-xs text-green-700 mt-2 list-disc pl-4 space-y-1">
                <li>Web_Viewer</li>
                <li>InApp_Update</li>
                <li>Network</li>
                <li>Download</li>
                <li>Tiny_DB / Tiny_Web_DB</li>
                <li>QR_Code / Barcode_Scanner</li>
                <li>Fingerprint</li>
                <li>Sharing</li>
              </ul>
            </div>
          ) : (
            <p className="text-sm text-outline italic">No se detectó un entorno Kodular activo.</p>
          )}
        </div>

        <hr className="border-outline/10"/>

        <div>
          <h3 className="font-bold mb-4">Personalización Visual</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold m-1">Color Principal (P. ej: Azul)</label>
              <input 
                type="color" 
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold m-1">
                Tamaño de Fuente: {Math.round(((parseInt(fontSize) || 16) - 16) / 12 * 100)}%
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={Math.round(((parseInt(fontSize) || 16) - 16) / 12 * 100)}
                onChange={(e) => {
                  const percentage = parseInt(e.target.value);
                  const newSize = 16 + (percentage / 100) * 12;
                  setFontSize(`${newSize}px`);
                }}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
