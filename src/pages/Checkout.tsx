import jsPDF from 'jspdf';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  FileText,
  RefreshCw,
  ShoppingBag,
  X,
  CreditCard,
  Truck,
  MessageSquare,
  Mail,
  ChevronRight,
  Info,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { formatCurrency, formatDateBA, formatTimeBA } from '../lib/utils';
import { apiService } from '../services/apiService';
import type { LastOrder, Seller } from '../types';
import { cn } from '../lib/utils';

export default function Checkout() {
  const { cart, selectedClient, clearCart, saveDraft, drafts, currentDraftId, markDraftAsSent } =
    useCart();
  const { refreshData } = useApp();
  const { globalPin, setGlobalPin } = useAuth();
  const navigate = useNavigate();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState<{
    title: string;
    message: string;
    type: 'error' | 'success';
    orderId?: string | number;
  } | null>(null);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sellerPin, setSellerPin] = useState('');
  const [seller, setSeller] = useState<Seller | null>(null);
  const [pinError, setPinError] = useState('');

  const [form, setForm] = useState({
    iva: 21,
    discount: 0,
    recargo: 0,
    methodpay: '',
    transport: '',
    commit: '',
    otheremail: '',
  });

  const [sendEmail, setSendEmail] = useState(true);

  React.useEffect(() => {
    if (currentDraftId) {
      const draft = drafts.find((d) => d.id === currentDraftId);
      if (draft && draft.details) {
        setForm((prev) => ({
          ...prev,
          ...draft.details,
        }));
      }
    }
  }, [currentDraftId, drafts]);

  if (!orderFeedback && (!selectedClient || cart.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <div className="w-24 h-24 bg-warning/10 rounded-full flex items-center justify-center mb-6 text-warning">
          <ShoppingBag size={48} strokeWidth={1.5} />
        </div>
        <h3 className="text-2xl font-bold mb-2">Carrito incompleto</h3>
        <p className="text-[var(--color-text-muted)] max-w-xs mb-8">
          Para continuar con el pago, debes tener productos en tu carrito y un cliente asignado.
        </p>
        <button
          onClick={() => navigate('/carrito')}
          className="btn btn-primary btn-lg rounded-2xl px-8"
        >
          <ArrowLeft size={20} className="mr-2" /> Volver al Carrito
        </button>
      </div>
    );
  }

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discountAmount = (subtotal * (Number(form.discount) || 0)) / 100;
  const recargoAmount = (subtotal * (Number(form.recargo) || 0)) / 100;
  const baseForIva = subtotal - discountAmount + recargoAmount;
  const ivaAmount = (baseForIva * (Number(form.iva) || 0)) / 100;
  const finalTotal = baseForIva + ivaAmount;

  const handleConfirmOrder = async () => {
    if (!globalPin) {
      setIsConfirmModalOpen(false);
      setIsPinModalOpen(true);
      return;
    }

    setIsLoading(true);
    try {
      const sellerInfo = await apiService.loginSeller(globalPin);
      if (!sellerInfo) {
        setGlobalPin(null);
        setIsConfirmModalOpen(false);
        setIsPinModalOpen(true);
        setIsLoading(false);
        return;
      }
      setSeller(sellerInfo);

      const itemsToVerify = cart.map((item) => {
        const baseProductId = parseInt(item.id.split('-')[0]);
        const verificationItem: any = {
          product_id: baseProductId,
          price: item.price,
          stock: item.quantity,
        };
        if (item.vid) verificationItem.variation_id = parseInt(item.vid);
        return verificationItem;
      });

      const verifyRes = await apiService.verifyProducts(itemsToVerify, sellerInfo.id);

      if (!verifyRes.success || (verifyRes.failed && verifyRes.failed > 0)) {
        setIsConfirmModalOpen(false);
        setOrderFeedback({
          title: 'Cambios en el catálogo',
          message: verifyRes.message || 'Algunos productos han cambiado su estado o precio.',
          type: 'error',
        });
        setIsLoading(false);
        return;
      }

      setIsConfirmModalOpen(false);
      await executeCreateOrder(sellerInfo.id);
    } catch (e) {
      console.error(e);
      setIsConfirmModalOpen(false);
      setOrderFeedback({
        title: 'Error de conexión',
        message: 'No se pudo procesar el pedido. Intente nuevamente.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidatePin = async () => {
    if (!sellerPin) return;
    setIsLoading(true);
    setPinError('');
    try {
      const sellerInfo = await apiService.loginSeller(sellerPin);
      if (sellerInfo) {
        setGlobalPin(sellerPin);
        setSeller(sellerInfo);
        setIsPinModalOpen(false);
        await handleConfirmOrder();
      } else {
        setPinError('PIN incorrecto');
      }
    } catch (e) {
      setPinError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const executeCreateOrder = async (sellerId: string) => {
    setIsSendingOrder(true);
    setIsLoading(true);
    try {
      const result = await apiService.createOrder(
        selectedClient!.id,
        cart,
        { ...form, total_calc: finalTotal, sendEmail },
        sellerId,
        selectedClient || undefined,
      );

      if (result.success) {
        if (sendEmail && result.orderId) {
          await apiService.sendOrderEmail(result.orderId.toString(), sellerId).catch(console.error);
        }
        setLastOrder({
          client: selectedClient!,
          items: cart,
          details: form,
          total: finalTotal,
          date: new Date().toISOString(),
        });
        if (currentDraftId) markDraftAsSent(currentDraftId);
        setOrderFeedback({
          title: '¡Pedido Enviado!',
          message: result.message || 'El pedido se ha procesado correctamente.',
          type: 'success',
          orderId: result.orderId,
        });
        clearCart();
        await refreshData();
      } else {
        saveDraft(form);
        setOrderFeedback({
          title: 'Guardado como Borrador',
          message: 'Hubo un problema al enviar, pero el pedido se guardó localmente.',
          type: 'error',
        });
      }
    } catch (e) {
      saveDraft(form);
      setOrderFeedback({
        title: 'Error de Red',
        message: 'Se guardó como borrador debido a un fallo de conexión.',
        type: 'error',
      });
    } finally {
      setIsSendingOrder(false);
      setIsLoading(false);
    }
  };

  const generatePDF = () => {
    if (!lastOrder) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Resumen de Pedido', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Cliente: ${lastOrder.client.name}`, 20, 40);
    doc.text(`Fecha: ${formatDateBA(lastOrder.date)}`, 20, 50);
    doc.text(`Total: ${formatCurrency(lastOrder.total)}`, 20, 60);
    doc.save(`pedido_${lastOrder.client.name.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/carrito')}
          className="btn btn-ghost btn-square rounded-2xl bg-[var(--color-surface-800)]"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Finalizar Pedido</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Resumen y detalles finales</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Form */}
        <div className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <CreditCard size={20} className="text-primary" /> Detalles de Pago
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-[10px] font-bold uppercase tracking-widest tracking-widest opacity-60">IVA (%)</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered bg-[var(--color-surface-800)] font-bold"
                  value={form.iva}
                  onChange={(e) => setForm({ ...form, iva: Number(e.target.value) })}
                />
              </div>
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-[10px] font-bold uppercase tracking-widest tracking-widest opacity-60">Desc. (%)</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered bg-[var(--color-surface-800)] font-bold text-success"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-[10px] font-bold uppercase tracking-widest tracking-widest opacity-60">Recargo (%)</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered bg-[var(--color-surface-800)] font-bold text-error"
                  value={form.recargo}
                  onChange={(e) => setForm({ ...form, recargo: Number(e.target.value) })}
                />
              </div>
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-[10px] font-bold uppercase tracking-widest tracking-widest opacity-60">Método</span>
                </label>
                <input
                  type="text"
                  placeholder="Efectivo, Transfer..."
                  className="input input-bordered bg-[var(--color-surface-800)] font-bold"
                  value={form.methodpay}
                  onChange={(e) => setForm({ ...form, methodpay: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Truck size={20} className="text-primary" /> Logística
            </h3>
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-[10px] font-bold uppercase tracking-widest tracking-widest opacity-60">Transporte</span>
              </label>
              <input
                type="text"
                placeholder="Nombre de la empresa"
                className="input input-bordered bg-[var(--color-surface-800)] font-bold"
                value={form.transport}
                onChange={(e) => setForm({ ...form, transport: e.target.value })}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <MessageSquare size={20} className="text-primary" /> Notas
            </h3>
            <textarea
              className="textarea textarea-bordered bg-[var(--color-surface-800)] w-full h-24 font-medium"
              placeholder="Observaciones adicionales..."
              value={form.commit}
              onChange={(e) => setForm({ ...form, commit: e.target.value })}
            />
          </section>

          <section className="space-y-4">
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-4 p-4 bg-[var(--color-surface-800)] rounded-2xl border border-[var(--color-border)]">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                />
                <div>
                  <span className="label-text font-bold">Enviar Comprobante</span>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Se enviará el PDF al cliente automáticamente.</p>
                </div>
              </label>
            </div>
            {sendEmail && (
              <div className="form-control animate-fade-in">
                <label className="label py-1">
                  <span className="label-text text-[10px] font-bold uppercase tracking-widest tracking-widest opacity-60 flex items-center gap-1">
                    <Mail size={12} /> Copia a otro email
                  </span>
                </label>
                <input
                  type="email"
                  placeholder="vendedor@tecnogafas.com"
                  className="input input-bordered bg-[var(--color-surface-800)] font-medium"
                  value={form.otheremail}
                  onChange={(e) => setForm({ ...form, otheremail: e.target.value })}
                />
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Summary Card */}
        <div className="lg:sticky lg:top-20 h-fit">
          <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] shadow-2xl rounded-3xl overflow-hidden">
            <div className="p-6 bg-primary/10 border-b border-primary/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Resumen Total</span>
                <span className="badge badge-primary badge-sm font-bold">IVA INC.</span>
              </div>
              <h3 className="text-4xl font-black tracking-tighter text-primary">{formatCurrency(finalTotal)}</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Subtotal</span>
                  <span className="font-bold">{formatCurrency(subtotal)}</span>
                </div>
                {form.discount > 0 && (
                  <div className="flex justify-between text-sm text-success">
                    <span>Descuento ({form.discount}%)</span>
                    <span className="font-bold">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {form.recargo > 0 && (
                  <div className="flex justify-between text-sm text-error">
                    <span>Recargo ({form.recargo}%)</span>
                    <span className="font-bold">+{formatCurrency(recargoAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">IVA ({form.iva}%)</span>
                  <span className="font-bold">+{formatCurrency(ivaAmount)}</span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-[var(--color-border)]">
                <p className="text-[10px] font-bold uppercase tracking-widest tracking-widest text-[var(--color-text-muted)] mb-3">Productos ({cart.length})</p>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                  {cart.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs font-medium">
                      <span className="truncate pr-4">{item.quantity}x {item.name}</span>
                      <span className="shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 space-y-3">
                <button
                  onClick={() => setIsConfirmModalOpen(true)}
                  disabled={isLoading}
                  className="btn btn-primary btn-lg w-full rounded-2xl font-black text-lg h-16 shadow-lg shadow-primary/20"
                >
                  {isLoading ? <span className="loading loading-spinner" /> : 'Confirmar Pedido'}
                </button>
                <button
                  onClick={() => { saveDraft(form); navigate('/pedidos'); }}
                  className="btn btn-ghost btn-block text-[var(--color-text-muted)] hover:bg-base-300/10 gap-2"
                >
                  <FileText size={16} /> Guardar Borrador
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex items-start gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
            <Info size={18} className="text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
              Al confirmar, el pedido será procesado por el sistema central y se generará el comprobante correspondiente. Asegúrese de que todos los datos sean correctos.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsConfirmModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-[var(--color-surface-800)] p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-2">¿Confirmar pedido?</h3>
              <p className="text-[var(--color-text-muted)] text-sm mb-8">Se enviará el pedido final por un total de {formatCurrency(finalTotal)}</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setIsConfirmModalOpen(false)} className="btn btn-ghost rounded-xl">Cancelar</button>
                <button onClick={handleConfirmOrder} className="btn btn-primary rounded-xl">Confirmar</button>
              </div>
            </motion.div>
          </div>
        )}

        {isPinModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-[var(--color-surface-800)] p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
              <h3 className="text-xl font-bold mb-2">Autorización Requerida</h3>
              <p className="text-[var(--color-text-muted)] text-sm mb-6">Ingrese su PIN de vendedor para autorizar el envío.</p>
              <input
                type="password"
                inputMode="numeric"
                placeholder="••••••••"
                maxLength={8}
                className="input input-bordered w-full bg-[var(--color-surface-900)] text-center text-3xl tracking-[0.5rem] font-black h-16 mb-4"
                value={sellerPin}
                onChange={(e) => setSellerPin(e.target.value.replace(/[^0-9]/g, ''))}
                autoFocus
              />
              {pinError && <p className="text-error text-xs font-bold mb-4">{pinError}</p>}
              <div className="flex flex-col gap-2">
                <button onClick={handleValidatePin} disabled={isLoading || sellerPin.length !== 8} className="btn btn-primary btn-lg rounded-xl w-full">Validar y Enviar</button>
                <button onClick={() => setIsPinModalOpen(false)} className="btn btn-ghost btn-sm">Cancelar</button>
              </div>
            </motion.div>
          </div>
        )}

        {isSendingOrder && (
          <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl">
            <RefreshCw size={60} className="text-primary animate-spin mb-6" />
            <h3 className="text-2xl font-black tracking-widest uppercase">Procesando...</h3>
            <p className="text-[var(--color-text-muted)] animate-pulse mt-2">No cierre la aplicación</p>
          </div>
        )}

        {orderFeedback && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative bg-[var(--color-surface-800)] p-10 rounded-[2.5rem] max-w-md w-full text-center shadow-2xl">
              <div className={cn("w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6", orderFeedback.type === 'success' ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
                {orderFeedback.type === 'success' ? <Check size={50} /> : <AlertCircle size={50} />}
              </div>
              <h3 className="text-3xl font-black mb-2 tracking-tight">{orderFeedback.title}</h3>
              <p className="text-[var(--color-text-muted)] mb-8 leading-relaxed">{orderFeedback.message}</p>
              
              <div className="space-y-3">
                {orderFeedback.type === 'success' && (
                  <button onClick={generatePDF} className="btn btn-outline w-full rounded-2xl gap-2 h-14">
                    <Download size={20} /> Descargar Comprobante PDF
                  </button>
                )}
                <button onClick={() => { setOrderFeedback(null); navigate(orderFeedback.type === 'success' ? '/' : '/pedidos'); }} className="btn btn-primary w-full rounded-2xl font-bold h-14">
                  Finalizar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
