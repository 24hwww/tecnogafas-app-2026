import { useEffect, useState } from 'react';
import { Bell, Info, Loader2 } from 'lucide-react';
import { apiService } from '../services/apiService';

export default function Notifications() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const data = await apiService.getEvents();
        setEvents(data);
      } catch (err: any) {
        setError(err.message || 'Error al cargar eventos');
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Notificaciones</h2>
      
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : error ? (
          <div className="text-center p-4 text-red-500 bg-red-500/10 rounded-xl">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center p-8 text-on-surface-variant bg-surface-variant rounded-xl">
            No hay notificaciones
          </div>
        ) : (
          events.map((n, i) => (
            <div key={i} className="m3-card flex gap-4 items-start">
              <div className={`p-2 rounded-full ${
                n.type === 'success' || n.category === 'success' ? 'bg-green-100 text-green-600' : 
                n.type === 'warning' || n.category === 'warning' ? 'bg-orange-100 text-orange-600' : 
                'bg-blue-100 text-blue-600'
              }`}>
                <Bell size={20} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-sm">{n.title || n.action || 'Notificación'}</h4>
                  <span className="text-[0.625rem] text-on-surface-variant font-medium">
                    {n.timestamp ? new Date(n.timestamp).toLocaleString() : n.time || ''}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">{n.message || n.details || ''}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-primary/5 p-4 rounded-xl flex items-center gap-3 border border-primary/10">
        <Info size={20} className="text-primary" />
        <p className="text-xs font-medium text-on-surface-variant">
          Las notificaciones muestran todos los eventos del sistema.
        </p>
      </div>
    </div>
  );
}
