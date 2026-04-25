import { Bell, Info } from 'lucide-react';

export default function Notifications() {
  const notifications = [
    { id: 1, title: 'Nuevo Pedido', message: 'Se ha registrado un nuevo pedido de la sucursal CABA.', time: 'Hace 5 min', type: 'success' },
    { id: 2, title: 'Stock Bajo', message: 'El producto "Ray-Ban Wayfarer" tiene menos de 3 unidades.', time: 'Hace 2 horas', type: 'warning' },
    { id: 3, title: 'Cliente Registrado', message: 'María Garcia ha sido añadida exitosamente.', time: 'Hace 1 día', type: 'info' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Notificaciones</h2>
      
      <div className="space-y-3">
        {notifications.map((n) => (
          <div key={n.id} className="m3-card flex gap-4 items-start">
            <div className={`p-2 rounded-full ${
              n.type === 'success' ? 'bg-green-100 text-green-600' : 
              n.type === 'warning' ? 'bg-orange-100 text-orange-600' : 
              'bg-blue-100 text-blue-600'
            }`}>
              <Bell size={20} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-sm">{n.title}</h4>
                <span className="text-[10px] text-on-surface-variant font-medium">{n.time}</span>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">{n.message}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-primary/5 p-4 rounded-xl flex items-center gap-3 border border-primary/10">
        <Info size={20} className="text-primary" />
        <p className="text-xs font-medium text-on-surface-variant">
          Las notificaciones se sincronizan en tiempo real con el servidor.
        </p>
      </div>
    </div>
  );
}
