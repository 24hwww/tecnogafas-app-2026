import { useApp } from '../AppContext';
import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  const { primaryColor, fontSize, setPrimaryColor, setFontSize } = useApp();

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <SettingsIcon /> Personalización
      </h2>
      
      <div className="m3-card space-y-4">
        <div>
          <label className="block text-sm font-bold m-1">Color Principal (Azul)</label>
          <input 
            type="color" 
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="w-full h-10 rounded cursor-pointer"
          />
        </div>
        
        <div>
          <label className="block text-sm font-bold m-1">Tamaño de Fuente: {fontSize}</label>
          <input 
            type="range" 
            min="17" 
            max="26" 
            value={parseInt(fontSize)}
            onChange={(e) => setFontSize(`${e.target.value}px`)}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
