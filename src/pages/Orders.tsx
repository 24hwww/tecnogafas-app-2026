import {
  FileText,
  Loader2,
  Mail,
  RotateCcw,
  Search,
  X,
  Calendar,
  User,
  Tag,
  CreditCard,
  Truck,
  MessageSquare,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useMemo, useState, useCallback, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { PullToRefresh } from '../components/PullToRefresh';
import { useAuth } from '../contexts/AuthContext';
import { useOrders } from '../contexts/OrdersContext';
import {
  formatCurrency,
  formatDateTimeBA,
  cn,
} from '../lib/utils';
import { apiService } from '../services/apiService';
import type { Order } from '../types';

function OrderSkeleton() {
  return (
    <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-4 bg-[var(--color-surface-900)] rounded w-1/3"></div>
        <div className="h-4 bg-[var(--color-surface-900)] rounded w-1/4"></div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-[var(--color-surface-900)] rounded w-full"></div>
        <div className="h-3 bg-[var(--color-surface-900)] rounded w-5/6"></div>
      </div>
      <div className="pt-2 border-t border-[var(--color-border)]/10 flex justify-between">
        <div className="h-6 bg-[var(--color-surface-900)] rounded w-1/4"></div>
        <div className="h-6 bg-[var(--color-surface-900)] rounded w-1/3"></div>
      </div>
    </div>
  );
}

interface OrderCardProps {
  order: Order;
  isHighlight: boolean;
  sellers: any[];
  getOrderNumber: (title: string) => string | null;
  getSellerName: (id: string | number) => string;
  onViewDetails: (order: Order) => void;
  translateStatus: (status: string) => string;
}

const OrderCard = memo(({ order, isHighlight, sellers, getOrderNumber, getSellerName, onViewDetails, translateStatus }: OrderCardProps) => {
  const isPending = order.status.toLowerCase() === 'unattended';
  
  return (
    <motion.div
      layout
      key={order.id}
      initial={isHighlight ? { scale: 1.02, borderColor: 'var(--color-primary)' } : {}}
      animate={isHighlight ? { scale: 1, borderColor: 'var(--color-border)' } : {}}
      transition={{ duration: 1.5 }}
      className={cn(
         "card bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-2xl overflow-hidden hover:border-primary/40 transition-all group shadow-sm",
         isHighlight && "ring-2 ring-primary ring-offset-4 ring-offset-background"
      )}
    >
      <div className="p-5 flex items-start justify-between">
        <div className="space-y-1 flex-1 min-w-0 pr-4">
           <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                 #{getOrderNumber(order.rawData?.post_title || '') || order.id}
              </span>
              <span className={cn(
                 "text-[10px] font-bold px-2 py-0.5 rounded-full tracking-widest",
                 isPending ? "bg-primary/10 text-primary" : "bg-success/20 text-primary"
              )}>
                 {translateStatus(order.status)}
              </span>
           </div>
           <h4 className="text-lg font-black truncate">{order.clientName}</h4>
           <div className="flex items-center gap-3 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatDateTimeBA(order.createdAt)}</span>
              <span className="flex items-center gap-1"><User size={12} /> {getSellerName(order.sellerId)}</span>
           </div>
        </div>
        <div className="text-right shrink-0">
           <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Total</p>
           <p className="text-xl font-black text-primary leading-none">{formatCurrency(order.total || 0)}</p>
        </div>
      </div>
      
      <div className="px-5 py-4 bg-[var(--color-surface-900)]/50 border-t border-[var(--color-border)]/10 flex justify-between items-center">
         <span className="text-xs font-medium text-[var(--color-text-muted)]">{order.items?.length || 0} productos</span>
         <button
           id={`orders-view-details-btn-${order.id}`}
           onClick={() => onViewDetails(order)}
           className="btn btn-primary btn-sm rounded-xl gap-2 font-bold px-5"
         >
           Ver Detalles <ChevronRight size={16} />
         </button>
      </div>
    </motion.div>
  );
});

OrderCard.displayName = 'OrderCard';

export default function Orders() {
  const { orders, isOrdersLoading: isLoading, fetchOrders: refreshOrders } = useOrders();
  const { sellers, clients } = useApp();
  const { globalPin, setGlobalPin } = useAuth();
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get('id');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [actionType, setActionType] = useState<'pdf' | 'email' | 'status' | 'regenerar' | null>(
    null,
  );
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const getSellerName = useCallback((id: string | number) => {
    const seller = sellers.find((s) => s.id.toString() === id.toString());
    return seller ? seller.name : 'Vendedor Desconocido';
  }, [sellers]);

  const getOrderNumber = useCallback((title: string) => {
    const match = title.match(/#(\d+)/);
    return match ? match[1] : null;
  }, []);

  const translateStatus = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case 'unattended':
        return 'Pendiente';
      case 'attended':
        return 'Confirmado';
      default:
        return status;
    }
  }, []);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const matchesSearch =
      order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.rawData?.post_title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeller = !selectedSeller || order.sellerId.toString() === selectedSeller;
    const matchesCustomer = !selectedCustomer || order.clientId.toString() === selectedCustomer;
    return matchesSearch && matchesSeller && matchesCustomer;
  }), [orders, searchTerm, selectedSeller, selectedCustomer]);

  const handleActionClick = (type: 'pdf' | 'email' | 'status' | 'regenerar') => {
    setActionType(type);
    if (globalPin) {
      executeAction(globalPin);
    } else {
      setPinModalOpen(true);
      setPin('');
      setActionFeedback(null);
    }
  };

  const executeAction = async (validatedPin?: string) => {
    if (!selectedOrder || !actionType) return;
    const pinToUse = validatedPin || pin;
    if (!pinToUse || pinToUse.length !== 8) {
      setActionFeedback({ message: 'PIN inválido', type: 'error' });
      return;
    }

    setIsActionLoading(true);
    setActionFeedback(null);

    try {
      const seller = await apiService.loginSeller(pinToUse);
      if (!seller) {
        setActionFeedback({ message: 'PIN incorrecto', type: 'error' });
        setIsActionLoading(false);
        return;
      }

      setGlobalPin(pinToUse);
      setPinModalOpen(false);

      if (actionType === 'pdf') {
        const res = await apiService.sendOrderEmail(selectedOrder.id.toString(), seller.id);
        if (res.success && res.pdf_url) {
          window.open(res.pdf_url, '_blank');
        } else {
          throw new Error(res.message || 'Error al generar PDF');
        }
      } else if (actionType === 'email') {
        const res = await apiService.sendOrderEmail(selectedOrder.id.toString(), seller.id);
        if (!res.success) throw new Error(res.message || 'Error al enviar email');
        alert('Email enviado correctamente');
      } else if (actionType === 'status') {
        const newStatus = selectedOrder.status === 'unattended' ? 'attended' : 'unattended';
        const res = await apiService.updateOrderStatus(
          selectedOrder.id.toString(),
          newStatus,
          seller.id,
        );
        if (res.success) {
          setSelectedOrder({ ...selectedOrder, status: newStatus });
          refreshOrders();
        } else {
          throw new Error(res.message || 'Error al actualizar estado');
        }
      } else if (actionType === 'regenerar') {
        setIsRegenerating(true);
        const res = await apiService.regenerateOrder(selectedOrder.id.toString(), seller.id);
        setIsRegenerating(false);
        if (res.success) {
          alert('Pedido regenerado correctamente');
          refreshOrders();
        } else {
          throw new Error(res.message || 'Error al regenerar pedido');
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error en la acción';
      setActionFeedback({ message: errorMessage, type: 'error' });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <PullToRefresh onRefresh={refreshOrders}>
      <div className="space-y-8 max-w-5xl mx-auto pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 id="orders-title" className="text-3xl font-black tracking-tight">Pedidos</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Gestión y seguimiento de pedidos</p>
          </div>

        </div>

        {/* Filters Section - New Minimalist Layout */}
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
              <Search size={18} className="text-[var(--color-text-muted)]" />
            </div>
            <input
              id="orders-search-input"
              type="text"
              placeholder="Buscar pedidos..."
              className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-[var(--color-text-muted)]/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-[var(--color-surface-700)] transition-colors"
              >
                <X size={14} className="text-[var(--color-text-muted)]" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-xl">
              <User size={14} className="text-[var(--color-text-muted)]" />
                <select
                className="bg-transparent border-none outline-none text-sm font-medium min-w-[120px]"
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
              >
                <option value="">Vendedor</option>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-xl">
              <Tag size={14} className="text-[var(--color-text-muted)]" />
              <select
                className="bg-transparent border-none outline-none text-sm font-medium min-w-[120px]"
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
              >
                <option value="">Cliente</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Results Counter */}
            <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
              <span className="text-xs font-bold text-primary">{filteredOrders.length}</span>
              <span className="text-xs text-primary/70">resultados</span>
            </div>
          </div>

          {/* Active Filters Bar */}
          {(searchTerm || selectedSeller || selectedCustomer) && (
            <div className="flex items-center justify-between p-3 bg-[var(--color-surface-800)]/50 border border-[var(--color-border)]/50 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--color-text-muted)]">Filtros activos:</span>
                {searchTerm && (
                  <span className="px-2 py-1 bg-[var(--color-surface-700)] rounded text-xs font-medium">
                    "{searchTerm}"
                  </span>
                )}
                {selectedSeller && (
                  <span className="px-2 py-1 bg-[var(--color-surface-700)] rounded text-xs font-medium">
                    {sellers.find(s => s.id === selectedSeller)?.name}
                  </span>
                )}
                {selectedCustomer && (
                  <span className="px-2 py-1 bg-[var(--color-surface-700)] rounded text-xs font-medium">
                    {clients.find(c => c.id === selectedCustomer)?.name}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setSearchTerm(''); setSelectedSeller(''); setSelectedCustomer(''); }}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Limpiar todo
              </button>
            </div>
          )}
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => <OrderSkeleton key={i} />)
          ) : filteredOrders.length === 0 ? (
            <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] border-dashed py-20 flex flex-col items-center text-center opacity-50">
              <FileText size={60} className="mb-4" />
              <p className="text-xl font-bold">No se encontraron pedidos</p>
              <p className="text-sm mt-2">Intenta ajustar los filtros de búsqueda</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredOrders.map((order) => {
                const isHighlight = targetId?.toString() === order.id.toString();
                return (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isHighlight={isHighlight}
                    sellers={sellers}
                    getOrderNumber={getOrderNumber}
                    getSellerName={getSellerName}
                    onViewDetails={setSelectedOrder}
                    translateStatus={translateStatus}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Details Modal */}
        <AnimatePresence>
          {selectedOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setSelectedOrder(null)} />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
              >
                {/* Modal Header */}
                <div className="p-8 border-b border-[var(--color-border)]/10 flex justify-between items-center bg-primary/5">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-primary text-primary-content rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                        <FileText size={28} />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black tracking-tight leading-none">
                           #{getOrderNumber(selectedOrder.rawData?.post_title || '') || selectedOrder.id}
                        </h3>
                        <p className="text-sm font-bold text-[var(--color-text-muted)] mt-1 uppercase tracking-widest">Detalle del Pedido</p>
                     </div>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="btn btn-ghost btn-square rounded-2xl">
                    <X size={24} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-4">
                        <div className="flex items-start gap-3">
                           <User size={18} className="text-primary shrink-0 mt-1" />
                           <div>
                              <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Cliente</p>
                              <p className="font-bold text-lg">{selectedOrder.clientName}</p>
                           </div>
                        </div>
                        <div className="flex items-start gap-3">
                           <Tag size={18} className="text-primary shrink-0 mt-1" />
                           <div>
                              <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Estado</p>
                              <span className={cn(
                                 "badge badge-sm font-bold tracking-widest",
                                 selectedOrder.status.toLowerCase() === 'unattended' ? "badge-success/10" : "badge-primary"
                              )}>{translateStatus(selectedOrder.status)}</span>
                           </div>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <div className="flex items-start gap-3">
                           <Calendar size={18} className="text-primary shrink-0 mt-1" />
                           <div>
                              <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Fecha y Hora</p>
                              <p className="font-bold">{formatDateTimeBA(selectedOrder.createdAt)} hs</p>
                           </div>
                        </div>
                        <div className="flex items-start gap-3">
                           <TrendingUp size={18} className="text-primary shrink-0 mt-1" />
                           <div>
                              <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Vendedor</p>
                              <p className="font-bold">{getSellerName(selectedOrder.sellerId)}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Extra Details */}
                  <div className="bg-[var(--color-surface-900)] rounded-3xl p-6 border border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 gap-6">
                     <div className="flex items-center gap-3">
                        <Truck size={18} className="text-primary" />
                        <div>
                           <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Transporte</p>
                           <p className="font-bold text-sm">{selectedOrder.rawData?.transport || 'No especificado'}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <CreditCard size={18} className="text-primary" />
                        <div>
                           <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Método de Pago</p>
                           <p className="font-bold text-sm">{selectedOrder.rawData?.methodpay || 'No especificado'}</p>
                        </div>
                     </div>
                  </div>

                  {/* Note */}
                  <div className="space-y-2">
                     <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest flex items-center gap-2">
                        <MessageSquare size={14} /> Observaciones
                     </p>
                     <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 italic text-sm text-[var(--color-text-muted)]">
                        {selectedOrder.rawData?.customer_note || 'Sin observaciones adicionales.'}
                     </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-4">
                     <h4 className="text-xl font-black tracking-tight flex items-center gap-2">
                        <TrendingUp size={20} className="text-primary" /> Productos
                     </h4>
                     <div className="grid gap-2">
                        {selectedOrder.items.map((item, i) => (
                          <div key={i} className="flex justify-between items-center py-3 border-b border-[var(--color-border)]/5 last:border-0">
                             <div className="flex-1 min-w-0 pr-4">
                                <p className="font-bold text-sm truncate">{item.productName}</p>
                                <p className="text-xs text-[var(--color-text-muted)]">{item.quantity} x {formatCurrency(item.price)}</p>
                             </div>
                             <div className="text-right">
                                <p className="font-black text-primary">{formatCurrency(item.price * item.quantity)}</p>
                             </div>
                          </div>
                        ))}
                     </div>
                  </div>
                </div>

                {/* Modal Footer Summary */}
                <div className="p-8 bg-[var(--color-surface-900)] border-t border-[var(--color-border)]">
                   <div className="flex justify-between items-center mb-6">
                      <span className="text-xl font-black uppercase tracking-widest opacity-50">Total Final</span>
                      <span className="text-4xl font-black text-primary">{formatCurrency(selectedOrder.total)}</span>
                   </div>
                   
                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <button onClick={() => handleActionClick('status')} className="btn btn-outline rounded-2xl flex flex-col items-center gap-1 h-20">
                         <CheckCircle2 size={20} />
                         <span className="text-[10px] font-bold uppercase tracking-widest">{selectedOrder.status === 'unattended' ? 'Confirmado' : 'Pendiente'}</span>
                      </button>
                      <button onClick={() => handleActionClick('email')} className="btn btn-outline rounded-2xl flex flex-col items-center gap-1 h-20">
                         <Mail size={20} />
                         <span className="text-[10px] font-bold uppercase tracking-widest">Enviar</span>
                      </button>
                      <button onClick={() => handleActionClick('pdf')} className="btn btn-outline rounded-2xl flex flex-col items-center gap-1 h-20">
                         <FileText size={20} />
                         <span className="text-[10px] font-bold uppercase tracking-widest">PDF</span>
                      </button>
                      <button onClick={() => handleActionClick('regenerar')} className="btn btn-secondary rounded-2xl flex flex-col items-center gap-1 h-20">
                         {isRegenerating ? <Loader2 size={20} className="animate-spin" /> : <RotateCcw size={20} />}
                         <span className="text-[10px] font-bold uppercase tracking-widest">Regenerar</span>
                      </button>
                   </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* PIN Verification Modal */}
        <AnimatePresence>
          {pinModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setPinModalOpen(false)} />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-[var(--color-surface-800)] p-8 rounded-[2.5rem] max-w-sm w-full text-center shadow-2xl">
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                   <TrendingUp size={40} />
                </div>
                <h3 className="text-2xl font-bold mb-2">Autorización</h3>
                <p className="text-[var(--color-text-muted)] text-sm mb-8">Ingrese su PIN de vendedor para autorizar esta acción.</p>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••••••"
                  maxLength={8}
                  className="input input-bordered w-full bg-[var(--color-surface-900)] text-center text-3xl tracking-[0.5rem] font-black h-16 mb-4"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                />
                {actionFeedback && <p className={cn("text-xs font-bold mb-4 uppercase", actionFeedback.type === 'error' ? "text-error" : "text-success")}>{actionFeedback.message}</p>}
                <div className="flex flex-col gap-3">
                  <button onClick={() => executeAction()} disabled={isActionLoading || pin.length !== 8} className="btn btn-primary btn-lg rounded-2xl w-full h-14">
                    {isActionLoading ? <span className="loading loading-spinner" /> : 'Confirmar Acción'}
                  </button>
                  <button onClick={() => setPinModalOpen(false)} className="btn btn-ghost btn-sm">Cancelar</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PullToRefresh>
  );
}
