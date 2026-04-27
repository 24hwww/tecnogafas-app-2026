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
  );
}
