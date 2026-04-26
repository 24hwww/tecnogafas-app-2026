import { useState, useRef } from 'react';
import { useApp } from '../AppContext';
import { Package, Clock, CheckCircle2, ChevronRight, Save, Send, X, FileText, Mail, Share2, Loader2 } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { OrderSkeleton } from '../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import { Order, DraftOrder } from '../types';
import { toBlob } from 'html-to-image';

export default function Orders() {
  const { orders, drafts, isLoading, loadDraft } = useApp();
  const navigate = useNavigate();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sharingDraftId, setSharingDraftId] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Load only the 10 most recent orders
  const recentOrders = orders.slice(0, 10);

  const handleLoadDraft = (id: string) => {
    loadDraft(id);
    navigate('/checkout');
  };

  const handleShareDraft = async (draft: DraftOrder) => {
    setSharingDraftId(draft.id);
    
    setTimeout(async () => {
      if (receiptRef.current) {
        try {
          const blob = await toBlob(receiptRef.current, { style: { transform: 'scale(1)', margin: '0' }, width: 400 });
          if (blob) {
            const file = new File([blob], `Pedido_${draft.id.slice(-6)}.png`, { type: 'image/png' });
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: 'Pedido',
                text: 'Adjunto el borrador del pedido',
                files: [file]
              });
            } else {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Pedido_${draft.id.slice(-6)}.png`;
              a.click();
              URL.revokeObjectURL(url);
              alert('Imagen descargada. Puedes compartirla manualmente.');
            }
          }
        } catch (e) {
          console.error(e);
          alert('Error al generar la imagen del pedido.');
        } finally {
          setSharingDraftId(null);
        }
      }
    }, 200);
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
            <h2 className="text-2xl font-bold">Borradores</h2>
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
                
                <div className="p-4 flex justify-between items-center bg-surface gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold mb-1">Cliente</p>
                    <p className="text-sm font-bold truncate leading-tight">{draft.client.name}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button 
                      onClick={() => handleShareDraft(draft)}
                      disabled={sharingDraftId === draft.id}
                      className="m3-button-outlined !p-2 flex items-center justify-center border border-primary/20 text-primary hover:bg-primary/5 transition-colors disabled:opacity-50 h-[36px] w-[36px] rounded-lg shadow-sm"
                      title="Compartir pedido"
                    >
                      {sharingDraftId === draft.id ? <Loader2 size={16} className="animate-spin text-primary" /> : <Share2 size={16} className="text-primary" />}
                    </button>
                    <button 
                      onClick={() => handleLoadDraft(draft.id)}
                      className="m3-button-filled !py-2 !px-4 text-[10px] flex items-center gap-2 whitespace-nowrap h-[36px] shadow-sm hover:shadow-md transition-all active:scale-95 rounded-lg"
                    >
                      CONTINUAR <Send size={12} />
                    </button>
                  </div>
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
            
            <button 
              onClick={() => setSelectedOrder(order)}
              className="w-full p-2 bg-surface-variant/50 text-[10px] font-bold text-center flex items-center justify-center gap-1"
            >
              Ver Detalles <ChevronRight size={12} />
            </button>
          </div>
        )))}
      </div>
    </div>

    {selectedOrder && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="m3-card !bg-surface w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
          <div className="flex justify-between items-center border-b border-outline/10 pb-4">
            <h2 className="text-lg font-bold">Detalles Pedido {selectedOrder.id}</h2>
            <button onClick={() => setSelectedOrder(null)}><X size={20}/></button>
          </div>

          <div className="space-y-2 text-sm">
             <p><strong>Estado:</strong> {selectedOrder.status}</p>
             <p><strong>Fecha:</strong> {selectedOrder.createdAt}</p>
             <p><strong>Cliente:</strong> {selectedOrder.clientName}</p>
             <p><strong>Total:</strong> {formatCurrency(selectedOrder.total)}</p>
             <p><strong>Transporte:</strong> {selectedOrder.rawData.transport}</p>
             <p><strong>Método de pago:</strong> {selectedOrder.rawData.methodpay}</p>
          </div>
          
          <div className="space-y-2">
            <p className="font-bold text-sm">Productos:</p>
            {selectedOrder.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs border-b border-outline/5 pb-1">
                <span>{item.quantity} x {item.productName}</span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4">
            <button className="flex-1 m3-button-outlined flex items-center justify-center gap-2 py-2">
              <Mail size={16} /> Enviar Email
            </button>
            <button className="flex-1 m3-button-filled flex items-center justify-center gap-2 py-2">
              <FileText size={16} /> Descargar PDF
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Hidden Receipt for Image Generation */}
    <div className="absolute top-[-9999px] left-[-9999px]">
      {sharingDraftId && (
        <div ref={receiptRef} className="bg-white text-black p-6 w-[400px] shadow-lg rounded-xl flex flex-col font-sans" style={{ fontFamily: 'Inter, sans-serif' }}>
            {(() => {
              const d = drafts.find(x => x.id === sharingDraftId);
              if (!d) return null;
              const subtotal = d.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
              const discountAmount = (subtotal * (Number(d.details?.discount) || 0)) / 100;
              const recargoAmount = (subtotal * (Number(d.details?.recargo) || 0)) / 100;
              const baseForIva = subtotal - discountAmount + recargoAmount;
              const ivaAmount = (baseForIva * (Number(d.details?.iva) || 0)) / 100;
              const finalTotal = baseForIva + ivaAmount;

              return (
                <>
                  <div className="text-center border-b border-gray-200 pb-4 mb-4">
                    <h1 className="text-2xl font-bold uppercase tracking-tight">PRE-PEDIDO</h1>
                    <p className="text-sm text-gray-500">#{d.id.slice(-6)} - {new Date(d.date).toLocaleString()}</p>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm"><strong className="uppercase">Cliente:</strong> {d.client.name}</p>
                    <p className="text-sm"><strong>Email:</strong> {d.client.email}</p>
                  </div>
                  <div className="mb-4 border-b border-gray-200 pb-4">
                    <h2 className="font-bold text-sm uppercase tracking-wider mb-2">Productos</h2>
                    <ul className="space-y-2">
                      {d.items.map((item, i) => (
                        <li key={i} className="flex justify-between text-sm">
                          <span className="flex-1 pr-2 truncate">{item.quantity}x {item.name}</span>
                          <span className="font-mono">{formatCurrency(item.price * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-1 mb-4 border-b border-gray-200 pb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-mono">{formatCurrency(subtotal)}</span>
                    </div>
                    {Number(d.details?.discount) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Descuento ({d.details.discount}%)</span>
                        <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    {Number(d.details?.recargo) > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>Recargo ({d.details.recargo}%)</span>
                        <span className="font-mono">+{formatCurrency(recargoAmount)}</span>
                      </div>
                    )}
                    {Number(d.details?.iva) > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>IVA ({d.details.iva}%)</span>
                        <span className="font-mono">+{formatCurrency(ivaAmount)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-xl font-black uppercase">
                    <span>Total</span>
                    <span className="font-mono">{formatCurrency(finalTotal)}</span>
                  </div>
                </>
              );
            })()}
        </div>
      )}
    </div>
  </div>
  );
}
