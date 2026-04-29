import { useState, useRef } from 'react';
import { useApp } from '../AppContext';
import { Package, Clock, CheckCircle2, ChevronRight, Save, Send, X, FileText, Mail, Share2, Loader2 } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { OrderSkeleton } from '../components/Skeleton';
import { useNavigate, useLocation } from 'react-router-dom';
import { Order, DraftOrder } from '../types';
import { toBlob } from 'html-to-image';
import { PullToRefresh } from '../components/PullToRefresh';
import { motion } from 'motion/react';

import { apiService } from '../services/apiService';

export default function Orders() {
  const { orders, totalOrders, drafts, clients, sellers, isLoading, loadDraft, refreshData, globalPin, setGlobalPin, fetchOrders } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sharingDraftId, setSharingDraftId] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const perPage = 25;

  // New states for actions
  const [actionType, setActionType] = useState<'pdf'|'email'|null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{message: string, type: 'error'|'success'} | null>(null);
  
  // Fetch orders when page changes or filters change
  const loadPage = async (page: number, sellerId?: string, customerId?: string) => {
    setCurrentPage(page);
    await fetchOrders(
      page, 
      perPage, 
      sellerId ? parseInt(sellerId) : undefined, 
      customerId ? parseInt(customerId) : undefined
    );
  };

  const handleSellerChange = (sellerId: string) => {
    setSelectedSeller(sellerId);
    loadPage(1, sellerId, selectedCustomer);
  };

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomer(customerId);
    loadPage(1, selectedSeller, customerId);
  };
    
  // Filter orders by title locally
  const filteredOrders = orders.filter(order => order.rawData.post_title?.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleActionClick = async (type: 'pdf'|'email'|'status') => {
    setActionType(type);
    if (globalPin) {
      await executeAction(type, globalPin);
    } else {
      setPinModalOpen(true);
      setPin('');
      setActionFeedback(null);
    }
  };

  const executeAction = async (overrideActionType?: string, overridePin?: string) => {
    const currentPin = overridePin || pin;
    const currentAction = overrideActionType || actionType;
    
    if (!currentPin || !selectedOrder || !currentAction) return;
    setIsActionLoading(true);
    setActionFeedback(null);
    try {
      const sellerInfo = await apiService.loginSeller(currentPin);
      if (!sellerInfo) {
        setActionFeedback({ message: 'PIN incorrecto o error de red', type: 'error' });
        setIsActionLoading(false);
        return;
      }
      
      setGlobalPin(currentPin);
      
      if (currentAction === 'pdf') {
        const success = await apiService.downloadOrderPdf(selectedOrder.id, sellerInfo.id);
        if (success) {
           setPinModalOpen(false);
           alert('PDF descargado exitosamente');
        } else {
           setActionFeedback({ message: 'Error al descargar el PDF', type: 'error' });
        }
      } else if (currentAction === 'email') {
        const res = await apiService.sendOrderEmail(selectedOrder.id, sellerInfo.id);
        if (res.success) {
           setPinModalOpen(false);
           alert('Email enviado exitosamente');
        } else {
           setActionFeedback({ message: res.message, type: 'error' });
        }
      } else if (currentAction === 'status') {
        const newStatus = selectedOrder.status === 'Pendiente' ? 'attended' : 'unattended';
        const res = await apiService.updateOrderStatus(selectedOrder.id, newStatus, sellerInfo.id);
        if (res.success) {
           setPinModalOpen(false);
           alert(`Estado actualizado a ${newStatus === 'attended' ? 'Completado' : 'Pendiente'}`);
           window.location.reload(); // Quick refresh
        } else {
           setActionFeedback({ message: res.message, type: 'error' });
        }
      }
    } catch(e) {
      setActionFeedback({ message: 'Error de conexión', type: 'error' });
    } finally {
      setIsActionLoading(false);
    }
  };

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
      <PullToRefresh onRefresh={() => refreshData(false)}>
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 pt-20 min-h-[50vh]">
          <h3 className="text-xl font-bold">Sin Pedidos</h3>
          <p className="text-sm text-on-surface-variant">Todavía no has realizado ningún pedido.</p>
        </div>
      </PullToRefresh>
    );
  }

  return (
    <PullToRefresh onRefresh={() => refreshData(false)}>
      <div className="space-y-8 min-h-[50vh]">
        {/* Drafts Section */}
        {hasDrafts && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="orders-drafts-title" className="text-2xl font-bold">Borradores</h2>
              <span className="text-[0.625rem] bg-secondary/10 text-secondary px-2 py-0.5 font-bold uppercase tracking-wider">
                No Enviados
              </span>
            </div>
            
            <div className="space-y-3">
              {drafts.filter(d => d.status === 'no enviado').map((draft) => (
                <div key={draft.id} className="m3-card !p-0 overflow-hidden border-dashed border-2 border-outline/20">
                  <div className="p-4 border-b border-outline/10 flex justify-between items-center bg-surface-variant/20">
                    <div>
                      <p className="font-bold text-sm">Borrador #{draft.id.slice(-6)}</p>
                      <p className="text-[0.625rem] text-on-surface-variant">{new Date(draft.date).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-outline">
                      <Save size={14} />
                      PENDIENTE
                    </div>
                  </div>
                  
                  <div className="p-4 flex justify-between items-center bg-surface gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.625rem] text-on-surface-variant uppercase tracking-wider font-bold mb-1">Cliente</p>
                      <p className="text-sm font-bold truncate leading-tight">{draft.client.name}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button 
                        id={`orders-draft-share-btn-${draft.id}`}
                        onClick={() => handleShareDraft(draft)}
                        disabled={sharingDraftId === draft.id}
                        className="m3-button-outlined !p-2 flex items-center justify-center border border-primary/20 text-primary hover:bg-primary/5 transition-colors disabled:opacity-50 h-[36px] w-[36px] rounded-lg shadow-sm"
                        title="Compartir pedido"
                      >
                        {sharingDraftId === draft.id ? <Loader2 size={16} className="animate-spin text-primary" /> : <Share2 size={16} className="text-primary" />}
                      </button>
                      <button 
                        id={`orders-draft-continue-btn-${draft.id}`}
                        onClick={() => handleLoadDraft(draft.id)}
                        className="m3-button-filled !py-2 !px-4 text-[0.625rem] flex items-center gap-2 whitespace-nowrap h-[2.25rem] shadow-sm hover:shadow-md transition-all active:scale-95 rounded-lg"
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
            <h2 id="orders-title" className="text-2xl font-bold">Pedidos</h2>
          </div>
          
          <div className="flex flex-col gap-3">
            <input 
              id="orders-search-input"
              type="text" 
              placeholder="Buscar por título..." 
              className="w-full p-3 m3-input rounded-lg border border-outline/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            
            <div className="grid grid-cols-2 gap-3">
              <select 
                id="orders-seller-select"
                className="p-3 m3-input rounded-lg border border-outline/20 text-sm bg-surface"
                value={selectedSeller}
                onChange={(e) => handleSellerChange(e.target.value)}
              >
                <option value="">Todos los Vendedores</option>
                {sellers.map(seller => (
                  <option key={seller.id} value={seller.id}>{seller.name}</option>
                ))}
              </select>
              
              <select 
                id="orders-client-select"
                className="p-3 m3-input rounded-lg border border-outline/20 text-sm bg-surface"
                value={selectedCustomer}
                onChange={(e) => handleCustomerChange(e.target.value)}
              >
                <option value="">Todos los Clientes</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="space-y-3">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => <OrderSkeleton key={i} />)
            ) : filteredOrders.length === 0 ? (
                <p className="text-center p-4 text-on-surface-variant text-sm">No se encontraron pedidos</p>
            ) : (
              filteredOrders.map((order) => {
                const isNew = location.state?.newOrderId == order.id;
                return (
                  <motion.div
                    key={order.id}
                    initial={isNew ? { backgroundColor: '#fef3c7' } : {}}
                    animate={isNew ? { backgroundColor: 'transparent' } : {}}
                    transition={{ duration: 2 }}
                    className="m3-card !p-0 overflow-hidden"
                  >
                    <div className="p-4 border-b border-outline/10 flex justify-between items-center bg-primary/5">
                      <div>
                        <p className="font-bold text-sm">{order.rawData.post_title} – {new Date(order.createdAt).toLocaleString('es-AR', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'})}</p>
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
                      id={`orders-view-details-btn-${order.id}`}
                      onClick={() => setSelectedOrder(order)}
                      className="w-full p-2 bg-surface-variant/50 text-[0.625rem] font-bold text-center flex items-center justify-center gap-1"
                    >
                      Ver Detalles <ChevronRight size={12} />
                    </button>
                  </motion.div>
                );
              })
            )}
            
            {/* Pagination Controls */}
            {!isLoading && totalOrders > perPage && (
              <div className="flex justify-center items-center gap-4 pt-4">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => loadPage(currentPage - 1, selectedSeller, selectedCustomer)}
                  className="m3-button-outlined !py-2 !px-4 disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-sm font-bold">Página {currentPage} de {Math.max(1, Math.ceil(totalOrders / perPage))}</span>
                <button 
                   disabled={currentPage >= Math.ceil(totalOrders / perPage)}
                   onClick={() => loadPage(currentPage + 1, selectedSeller, selectedCustomer)}
                   className="m3-button-outlined !py-2 !px-4 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="m3-card !bg-surface w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b border-outline/10 pb-4">
              <h2 id="orders-modal-title" className="text-xl font-bold text-primary">Pedido {selectedOrder.id}</h2>
              <button id="orders-modal-close-btn" onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-surface-variant rounded-full transition-colors"><X size={20}/></button>
            </div>

            <div className="space-y-4 text-sm bg-surface-variant/20 p-4 rounded-lg">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <p className="text-[0.625rem] uppercase font-bold text-outline">Estado</p>
                   <p className="font-bold">{selectedOrder.status}</p>
                 </div>
                 <div>
                   <p className="text-[0.625rem] uppercase font-bold text-outline">Fecha</p>
                   <p className="font-medium">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                 </div>
                 <div>
                   <p className="text-[0.625rem] uppercase font-bold text-outline">Cliente</p>
                   <p className="font-bold">{selectedOrder.clientName}</p>
                 </div>
                 <div>
                   <p className="text-[0.625rem] uppercase font-bold text-outline">País</p>
                   <p className="font-medium">{selectedOrder.rawData.billing?.country || 'N/A'}</p>
                 </div>
                 <div>
                   <p className="text-[0.625rem] uppercase font-bold text-outline">Transporte</p>
                   <p className="font-medium">{selectedOrder.rawData.transport || 'Sin definir'}</p>
                 </div>
                 <div>
                   <p className="text-[0.625rem] uppercase font-bold text-outline">Método de Pago</p>
                   <p className="font-medium">{selectedOrder.rawData.methodpay || 'Sin definir'}</p>
                 </div>
               </div>

               <div className="pt-3 border-t border-outline/10">
                 <p className="text-[0.625rem] uppercase font-bold text-outline mb-1">Observaciones</p>
                 <div className="bg-surface p-3 rounded border border-outline/10 text-sm font-medium italic text-on-surface">
                   {selectedOrder.rawData.customer_note || "Sin observaciones adicionales."}
                 </div>
               </div>

               <div className="pt-3 border-t border-outline/10">
                 <div className="flex justify-between text-xs mb-1">
                   <span className="text-outline">Descuento</span>
                   <span className="font-medium">{selectedOrder.rawData.discount}%</span>
                 </div>
                 <div className="flex justify-between text-xs mb-1">
                   <span className="text-outline">Recargo</span>
                   <span className="font-medium">{selectedOrder.rawData.recargo}%</span>
                 </div>
                 <div className="flex justify-between text-xs">
                   <span className="text-outline">IVA</span>
                   <span className="font-medium">{selectedOrder.rawData.iva}%</span>
                 </div>
               </div>
            </div>
            
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center">
                <p className="font-bold text-sm uppercase tracking-wider text-primary">Productos</p>
                <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{selectedOrder.items.length} items</span>
              </div>
              <div className="max-h-[200px] overflow-y-auto pr-1 space-y-1">
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs py-2 border-b border-outline/5 last:border-0">
                    <div className="flex-1 pr-4">
                      <p className="font-bold">{item.productName}</p>
                      <p className="text-outline">{item.quantity} x {formatCurrency(item.price)}</p>
                    </div>
                    <div className="text-right font-bold">
                      {formatCurrency(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t-2 border-primary/20 flex justify-between items-center">
                <span className="font-black text-sm uppercase">Total Pedido</span>
                <span className="font-black text-xl text-primary">{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t border-outline/10">
              <button 
                 id="orders-modal-status-btn"
                 onClick={() => handleActionClick('status')}
                 className="w-full m3-button-outlined flex items-center justify-center gap-2 py-3"
              >
                <CheckCircle2 size={16} /> {selectedOrder.status === 'Pendiente' ? 'Marcar Atendido' : 'Marcar Pendiente'}
              </button>
              <button 
                 id="orders-modal-email-btn"
                 onClick={() => handleActionClick('email')}
                 className="w-full m3-button-outlined flex items-center justify-center gap-2 py-3"
              >
                <Mail size={16} /> Enviar Email
              </button>
              <button 
                 id="orders-modal-pdf-btn"
                 onClick={() => handleActionClick('pdf')}
                 className="w-full m3-button-filled flex items-center justify-center gap-2 py-3"
              >
                <FileText size={16} /> Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {pinModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isActionLoading && setPinModalOpen(false)} />
          <div className="relative bg-surface w-full max-w-xs p-6 shadow-2xl text-center space-y-4 rounded-xl">
            <h3 className="text-xl font-bold uppercase tracking-tight">Autorización</h3>
            <p className="text-sm text-on-surface-variant">Ingrese su PIN de vendedor para {actionType === 'pdf' ? 'descargar' : 'enviar'} el pedido</p>
            <input
              type="password"
              autoFocus
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                setPin(value);
              }}
              className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 m3-input"
              maxLength={8}
              placeholder="••••••••"
            />
            {actionFeedback && (
              <p className={`text-xs font-bold ${actionFeedback.type === 'error' ? 'text-red-500' : 'text-primary'}`}>{actionFeedback.message}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setPinModalOpen(false)}
                disabled={isActionLoading}
                className="flex-1 py-3 bg-surface-variant font-bold rounded"
              >
                Cancelar
              </button>
              <button 
                onClick={() => executeAction()}
                disabled={!pin || pin.length !== 8 || isActionLoading}
                className="flex-1 py-3 m3-button-filled font-bold flex items-center justify-center gap-2"
              >
                {isActionLoading && <Loader2 size={16} className="animate-spin" />}
                Confirmar
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
  </PullToRefresh>
);
}
