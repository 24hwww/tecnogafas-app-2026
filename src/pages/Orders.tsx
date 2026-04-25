import { useApp } from '../AppContext';
import { Package, Clock, CheckCircle2, ChevronRight, Save, Send } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { OrderSkeleton } from '../components/Skeleton';
import { useNavigate } from 'react-router-dom';

export default function Orders() {
  const { orders, drafts, isLoading, loadDraft } = useApp();
  const navigate = useNavigate();
  
  // Load only the 10 most recent orders
  const recentOrders = orders.slice(0, 10);

  const handleLoadDraft = (id: string) => {
    loadDraft(id);
    navigate('/checkout');
  };

  const hasDrafts = drafts.length > 0;
  const noOrders = orders.length === 0 && !hasDrafts;

  if (!isLoading && noOrders) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 pt-20">
        <h3 className="text-xl font-bold">Sin Pedidos</h3>
        <p className="text-sm text-on-surface-variant">Todavía no has realizado ningún pedido.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Drafts Section */}
      {hasDrafts && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Borradores (Local)</h2>
            <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 font-bold uppercase tracking-wider">
              No Enviados
            </span>
          </div>
          
          <div className="space-y-3">
            {drafts.filter(d => d.status === 'no enviado').map((draft) => (
              <div key={draft.id} className="m3-card !p-0 overflow-hidden border-dashed border-2 border-outline/20">
                <div className="p-4 border-b border-outline/10 flex justify-between items-center bg-surface-variant/20">
                  <div>
                    <p className="font-bold text-sm">Borrador #{draft.id.slice(-6)}</p>
                    <p className="text-[10px] text-on-surface-variant">{new Date(draft.date).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-outline">
                    <Save size={14} />
                    PENDIENTE
                  </div>
                </div>
                
                <div className="p-4 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-on-surface-variant">Cliente</p>
                    <p className="text-sm font-bold">{draft.client.name}</p>
                  </div>
                  <button 
                    onClick={() => handleLoadDraft(draft.id)}
                    className="m3-button-filled !py-2 !px-4 text-[10px] flex items-center gap-2"
                  >
                    CONTINUAR <Send size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Mis Pedidos</h2>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 font-bold uppercase tracking-wider">
            Top 10 Recientes
          </span>
        </div>
        
        <div className="space-y-3">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => <OrderSkeleton key={i} />)
          ) : (
            recentOrders.map((order) => (
            <div key={order.id} className="m3-card !p-0 overflow-hidden">
            <div className="p-4 border-b border-outline/10 flex justify-between items-center bg-primary/5">
              <div>
                <p className="font-bold text-sm">Pedido #{order.id.slice(-6)}</p>
                <p className="text-[10px] text-on-surface-variant">{new Date(order.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-primary">
                {order.status === 'Pendiente' ? <Clock size={14} /> : <CheckCircle2 size={14} />}
                {order.status}
              </div>
            </div>
            
            <div className="p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-on-surface-variant">Cliente</span>
                <span className="text-xs font-medium">{order.clientName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-on-surface-variant">Estado</span>
                <span className="text-xs font-medium bg-primary/10 px-2 py-0.5 text-primary">{order.status}</span>
              </div>
              <div className="pt-2 border-t border-outline/5 flex justify-between items-center">
                <span className="font-bold">Total</span>
                <span className="font-bold text-primary text-lg">{formatCurrency(order.total || 0)}</span>
              </div>
            </div>
            
            <button className="w-full p-2 bg-surface-variant/50 text-[10px] font-bold text-center flex items-center justify-center gap-1">
              Ver Detalles <ChevronRight size={12} />
            </button>
          </div>
        )))}
      </div>
    </div>
  </div>
  );
}
