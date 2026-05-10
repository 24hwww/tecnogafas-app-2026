import jsPDF from 'jspdf';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Info,
  Mail,
  MessageSquare,
  RefreshCw,
  ShoppingBag,
  Truck,
  User,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { formatCurrency, formatDateBA, generateOrderTitle } from '../lib/utils';
import { apiService } from '../services/apiService';
import { appDB } from '../stores/appDatabase';
import type { ApiOrder, LastOrder, OrderItem, Seller } from '../types';

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
  const [pinError, setPinError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isValidatingPin, setIsValidatingPin] = useState(false);

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

  const calculations = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const discountAmount = (subtotal * (Number(form.discount) || 0)) / 100;
    const recargoAmount = (subtotal * (Number(form.recargo) || 0)) / 100;
    const baseForIva = subtotal - discountAmount + recargoAmount;
    const ivaAmount = (baseForIva * (Number(form.iva) || 0)) / 100;
    const finalTotal = baseForIva + ivaAmount;
    return { subtotal, discountAmount, recargoAmount, baseForIva, ivaAmount, finalTotal };
  }, [cart, form.discount, form.recargo, form.iva]);

  const { subtotal, discountAmount, recargoAmount, ivaAmount, finalTotal } = calculations;

  if (!orderFeedback && (!selectedClient || cart.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <div className="w-24 h-24 bg-[var(--color-surface-900)] rounded-full flex items-center justify-center mb-6 border border-[var(--color-border)]">
          <ShoppingBag size={48} className="text-[var(--color-text-muted)] opacity-50" />
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

  const handleConfirmOrder = async () => {
    if (!globalPin) {
      setIsConfirmModalOpen(false);
      setIsPinModalOpen(true);
      return;
    }

    setIsLoading(true);
    try {
      const sellerInfo = await apiService.loginSeller(globalPin);
      if (!sellerInfo || !sellerInfo.id) {
        console.error('[Checkout] ERROR: Login falló o no devolvió sellerId válido');
        setGlobalPin(null);
        setIsConfirmModalOpen(false);
        setIsPinModalOpen(true);
        setIsLoading(false);
        return;
      }

      // VALIDACIÓN CRÍTICA: Asegurar que el sellerId sea válido
      if (sellerInfo.id === 'default_seller' || sellerInfo.id.trim() === '') {
        console.error('[Checkout] ERROR: sellerId inválido después del login:', sellerInfo.id);
        setOrderFeedback({
          title: 'Error de Autenticación',
          message: 'No se pudo obtener un ID de vendedor válido. Por favor, intente nuevamente.',
          type: 'error',
        });
        setIsConfirmModalOpen(false);
        setIsPinModalOpen(true);
        setIsLoading(false);
        return;
      }

      const itemsToVerify = cart.map((item) => {
        const baseProductId = parseInt(item.id.split('-')[0] ?? '', 10);
        const verificationItem: {
          product_id: number;
          price: number;
          stock: number;
          variation_id?: number;
        } = {
          product_id: baseProductId,
          price: item.price,
          stock: item.quantity,
        };
        if (item.vid) verificationItem.variation_id = parseInt(item.vid, 10);
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
      await createOrder(sellerInfo.id, sellerInfo);
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
    setIsValidatingPin(true);
    setPinError('');

    try {
      // 1. Guardar borrador del pedido antes de validar
      saveDraft(form);

      // 2. Validar PIN del vendedor
      const sellerInfo = await apiService.loginSeller(sellerPin);
      if (!sellerInfo) {
        setPinError('PIN incorrecto');
        return;
      }

      // 3. Guardar PIN global y cerrar modal
      setGlobalPin(sellerPin);
      setIsPinModalOpen(false);

      // 4. Verificar productos
      const itemsToVerify = cart.map((item) => {
        const baseProductId = parseInt(item.id.split('-')[0] ?? '', 10);
        const verificationItem: {
          product_id: number;
          price: number;
          stock: number;
          variation_id?: number;
        } = {
          product_id: baseProductId,
          price: item.price,
          stock: item.quantity,
        };
        if (item.vid) verificationItem.variation_id = parseInt(item.vid, 10);
        return verificationItem;
      });

      const verifyRes = await apiService.verifyProducts(itemsToVerify, sellerInfo.id);
      if (!verifyRes.success || (verifyRes.failed && verifyRes.failed > 0)) {
        setOrderFeedback({
          title: 'Cambios en el catálogo',
          message: verifyRes.message || 'Algunos productos han cambiado su estado o precio.',
          type: 'error',
        });
        return;
      }

      // 5. Enviar pedido al endpoint /api/pedido
      await createOrder(sellerInfo.id, sellerInfo);
    } catch (error) {
      console.error('PIN validation error:', error);
      setPinError('Error de conexión');
    } finally {
      setIsValidatingPin(false);
    }
  };

  const createOrder = async (sellerId: string, sellerInfo?: Seller) => {
    setIsSendingOrder(true);
    setIsLoading(true);

    // VALIDACIÓN CRÍTICA: Asegurar que tenemos un sellerId válido
    if (!sellerId || sellerId.trim() === '') {
      console.error('[Checkout] ERROR: Intento de crear pedido sin sellerId');
      setOrderFeedback({
        title: 'Error de Autenticación',
        message: 'No se puede crear el pedido sin la autenticación del vendedor',
        type: 'error',
      });
      setIsSendingOrder(false);
      setIsLoading(false);
      return;
    }

    try {
      // Usar el servicio de API unificado
      const result = await apiService.createOrder(
        selectedClient!.id,
        cart,
        {
          ...form,
          sendEmail,
          iva: form.iva || 0,
          discount: form.discount || 0,
          recargo: form.recargo || 0,
          methodpay: form.methodpay || '',
          transport: form.transport || '',
          commit: form.commit || '',
          otheremail: form.otheremail || '',
        },
        sellerId,
        selectedClient || undefined,
      );

      const isPendingOrder =
        !result.success && typeof result.orderId === 'string' && result.orderId.startsWith('pending-');

      if (result.success || isPendingOrder) {
        // Enviar email si está configurado
        if (result.success && sendEmail && result.orderId) {
          await apiService.sendOrderEmail(result.orderId.toString(), sellerId).catch(console.error);
        }

        // Guardar último pedido
        setLastOrder({
          client: selectedClient!,
          items: cart,
          details: form,
          total: finalTotal,
          date: new Date().toISOString(),
        });

        // Marcar borrador como enviado si existe
        if (currentDraftId) markDraftAsSent(currentDraftId);

        // Mostrar feedback de éxito
        setOrderFeedback({
          title: isPendingOrder ? 'Pedido pendiente' : '¡Pedido Enviado!',
          message: result.message || 'El pedido se ha procesado correctamente.',
          type: 'success',
          orderId: result.orderId,
        });

        // Generar título y guardar en Dexie
        const orderSequence = Date.now();
        const orderTitle = generateOrderTitle(orderSequence);
        const orderItems: OrderItem[] = cart.map((item) => ({
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          vid: item.vid,
        }));

        const orderForDexie = {
          id: result.orderId?.toString() || orderSequence.toString(),
          clientId: selectedClient!.id,
          clientName: selectedClient!.name,
          items: orderItems,
          total: finalTotal,
          status: 'unattended' as const,
          createdAt: new Date().toISOString(),
          sellerId: sellerId,
          sellerName: sellerInfo?.name || '',
          rawData: (result.rawData || {}) as ApiOrder,
          title: orderTitle,
        };

        if (result.success) {
          await appDB.orders.put(orderForDexie);
        }

        // Limpiar carrito y refrescar datos
        clearCart();
        await refreshData();
      } else {
        // Guardar como borrador si hay error
        saveDraft(form);
        setOrderFeedback({
          title: 'Guardado como Borrador',
          message:
            result.message || 'Hubo un problema al enviar, pero el pedido se guardó localmente.',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Order creation error:', error);
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

  const generatePDF = async () => {
    if (!orderFeedback?.orderId) return;

    try {
      // Llamar al endpoint de la API para generar el PDF
      const blob = await apiService.downloadOrderPdf(orderFeedback.orderId, globalPin || '');
      if (!blob) {
        throw new Error('Error al generar el PDF');
      }

      // Crear URL temporal y descargar
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `pedido_${orderFeedback.orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback: generar PDF local si hay error con la API
      if (lastOrder) {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text('Resumen de Pedido', 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Cliente: ${lastOrder.client.name}`, 20, 40);
        doc.text(`Fecha: ${formatDateBA(lastOrder.date)}`, 20, 50);
        doc.text(`Total: ${formatCurrency(lastOrder.total)}`, 20, 60);
        doc.save(`pedido_${lastOrder.client.name.replace(/\s/g, '_')}.pdf`);
      }
    }
  };

  return (
    <div className="space-y-6 mx-auto pb-32">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Form */}
        <div className="space-y-6">
          {/* Payment Details Card */}
          <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CreditCard size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-success">Detalles de Pago</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Configura los términos de pago
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold uppercase opacity-60">
                    IVA (%)
                  </span>
                </label>
                <input
                  type="number"
                  className="input input-bordered bg-[var(--color-surface-900)] font-bold"
                  value={form.iva}
                  onChange={(e) => setForm({ ...form, iva: Number(e.target.value) })}
                />
              </div>
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold uppercase opacity-60">
                    Descuento
                  </span>
                </label>
                <input
                  type="number"
                  className="input input-bordered bg-[var(--color-surface-900)] font-bold text-success"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold uppercase opacity-60">
                    Recargo
                  </span>
                </label>
                <input
                  type="number"
                  className="input input-bordered bg-[var(--color-surface-900)] font-bold text-error"
                  value={form.recargo}
                  onChange={(e) => setForm({ ...form, recargo: Number(e.target.value) })}
                />
              </div>
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold uppercase opacity-60">
                    Método de Pago
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Efectivo, Transferencia..."
                  className="input input-bordered bg-[var(--color-surface-900)] font-bold"
                  value={form.methodpay}
                  onChange={(e) => setForm({ ...form, methodpay: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Logistics Card */}
          <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Truck size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-success">Logística</h3>
                <p className="text-sm text-[var(--color-text-muted)]">Información de envío</p>
              </div>
            </div>

            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold uppercase opacity-60">
                  Transporte
                </span>
              </label>
              <input
                type="text"
                placeholder="Nombre de la empresa de transporte"
                className="input input-bordered bg-[var(--color-surface-900)] font-bold w-full"
                value={form.transport}
                onChange={(e) => setForm({ ...form, transport: e.target.value })}
              />
            </div>
          </div>

          {/* Notes Card */}
          <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <MessageSquare size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-success">Notas</h3>
                <p className="text-sm text-[var(--color-text-muted)]">Observaciones adicionales</p>
              </div>
            </div>

            <div className="form-control">
              <textarea
                className="textarea textarea-bordered bg-[var(--color-surface-900)] w-full h-24 font-medium"
                placeholder="Agrega cualquier observación importante sobre el pedido..."
                value={form.commit}
                onChange={(e) => setForm({ ...form, commit: e.target.value })}
              />
            </div>
          </div>

          {/* Email Options Card */}
          <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Mail size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-success">Opciones de Envío</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Configuración de notificaciones
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-4 p-4 bg-[var(--color-surface-900)] rounded-2xl border border-[var(--color-border)] w-full">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                  />
                  <div>
                    <span className="label-text font-bold text-[var(--color-text-muted)]">
                      Enviar Comprobante
                    </span>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      Se enviará el PDF automáticamente al cliente
                    </p>
                  </div>
                </label>
              </div>

              {sendEmail && (
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs font-semibold uppercase opacity-60 flex items-center gap-1">
                      <Mail size={12} /> Copia a otro email
                    </span>
                  </label>
                  <input
                    type="email"
                    placeholder="vendedor@tecnogafas.com"
                    className="input input-bordered bg-[var(--color-surface-900)] font-medium w-full"
                    value={form.otheremail}
                    onChange={(e) => setForm({ ...form, otheremail: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Summary Card */}
        <div className="lg:sticky lg:top-20 h-fit">
          <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-primary/10 border-b border-primary/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                  Resumen Total
                </span>
                <span className="badge badge-primary badge-sm font-bold">IVA INC.</span>
              </div>
              <h3 className="text-4xl font-black tracking-tighter text-primary">
                {formatCurrency(finalTotal)}
              </h3>
            </div>

            {/* Client Information */}
            {selectedClient && (
              <div className="p-6 bg-gradient-to-r from-primary/5 to-transparent border-b border-primary/10">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                      Cliente
                    </p>
                    <p className="text-sm font-bold text-primary truncate">{selectedClient.name}</p>
                    {selectedClient.email && (
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        {selectedClient.email}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => navigate('/clientes')}
                    className="btn btn-ghost btn-xs text-primary hover:bg-primary/10 rounded-lg"
                    title="Cambiar cliente"
                  >
                    <ArrowLeft size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Pricing Breakdown */}
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

              {/* Products List */}
              <div className="pt-4 border-t border-[var(--color-border)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
                  Productos ({cart.length})
                </p>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                  {cart.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs font-medium">
                      <span className="truncate pr-4">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 space-y-3">
                <button
                  onClick={() => setIsConfirmModalOpen(true)}
                  disabled={isLoading}
                  className="btn btn-primary btn-lg w-full rounded-2xl font-bold text-lg h-16 shadow-lg shadow-primary/20"
                >
                  {isLoading ? <span className="loading loading-spinner" /> : 'Confirmar Pedido'}
                </button>

                <button
                  onClick={() => {
                    saveDraft(form);
                    navigate('/pedidos');
                  }}
                  className="btn btn-ghost btn-block text-[var(--color-text-muted)] hover:bg-base-300/10 gap-2"
                >
                  <FileText size={16} /> Guardar Borrador
                </button>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="mt-6 flex items-start gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
            <Info size={16} className="text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
              Al confirmar, el pedido será procesado por el sistema central y se generará el
              comprobante correspondiente. Asegúrese de que todos los datos sean correctos.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsConfirmModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative bg-gradient-to-br from-[var(--color-surface-800)] to-[var(--color-surface-900)] border border-[var(--color-border)] rounded-3xl max-w-sm w-full text-center shadow-2xl mx-4 overflow-hidden"
            >
              {/* Background decoration */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 p-8">
                <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20 shadow-lg">
                  <ShoppingBag size={40} />
                </div>

                <h3 className="text-3xl font-black mb-3 tracking-tight bg-gradient-to-r from-white to-white/80 bg-clip-text">
                  ¿Confirmar pedido?
                </h3>
                <p className="text-[var(--color-text-muted)] text-sm mb-6 leading-relaxed">
                  Se enviará el pedido final por el siguiente total:
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="btn btn-ghost rounded-xl h-14 font-bold hover:bg-[var(--color-surface-700)] border border-[var(--color-border)]/50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmOrder}
                    className="btn btn-primary rounded-xl h-14 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isPinModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative bg-gradient-to-br from-[var(--color-surface-800)] to-[var(--color-surface-900)] border border-[var(--color-border)] rounded-3xl max-w-sm w-full text-center shadow-2xl mx-4 overflow-hidden"
            >
              {/* Background decoration */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 p-8">
                <h3 className="text-3xl font-black mb-3 tracking-tight bg-gradient-to-r from-white to-white/80 bg-clip-text">
                  Autorización Requerida
                </h3>
                <p className="text-[var(--color-text-muted)] text-sm mb-6 leading-relaxed">
                  Ingrese su PIN de vendedor para autorizar el envío
                </p>

                <div className="bg-gradient-to-r from-warning/10 to-warning/5 border border-warning/20 rounded-2xl p-4 mb-6 relative">
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      placeholder="••••••••"
                      maxLength={8}
                      className="input input-bordered w-full bg-[var(--color-surface-900)] text-center text-3xl tracking-[0.5rem] font-black h-16 border-warning/20 focus:border-warning/40 pr-16"
                      value={sellerPin}
                      onChange={(e) => setSellerPin(e.target.value.replace(/[^0-9]/g, ''))}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-warning hover:text-warning/80 transition-colors p-2 hover:bg-warning/10 rounded-lg"
                      title={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                    >
                      {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {pinError && (
                  <div className="bg-error/10 border border-error/20 rounded-xl p-3 mb-4">
                    <p className="text-error text-xs font-bold flex items-center justify-center gap-2">
                      <AlertCircle size={14} />
                      {pinError}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleValidatePin}
                    disabled={isLoading || sellerPin.length !== 8 || isValidatingPin}
                    className="btn btn-primary btn-lg rounded-xl w-full h-14 font-bold shadow-primary/20 hover:shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isValidatingPin ? (
                      <>
                        <span className="loading loading-spinner loading-sm mr-2" />
                        Validando...
                      </>
                    ) : (
                      'Validar y Enviar'
                    )}
                  </button>
                  <button
                    onClick={() => setIsPinModalOpen(false)}
                    className="btn btn-ghost rounded-xl h-12 font-bold hover:bg-[var(--color-surface-700)] border border-[var(--color-border)]/50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isSendingOrder && (
          <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl p-4">
            <RefreshCw size={60} className="text-primary animate-spin mb-6" />
            <h3 className="text-2xl font-black tracking-widest uppercase">Procesando...</h3>
            <p className="text-[var(--color-text-muted)] animate-pulse mt-2">
              No cierre la aplicación
            </p>
          </div>
        )}

        {orderFeedback && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative bg-gradient-to-br from-[var(--color-surface-800)] to-[var(--color-surface-900)] border border-[var(--color-border)] rounded-3xl max-w-md w-full text-center shadow-2xl mx-4 overflow-hidden"
            >
              {/* Background decoration */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <div className={`absolute top-0 right-0 w-32 h-32 ${
                orderFeedback.type === 'success' ? 'bg-success/10' : 'bg-error/10'
              } rounded-full blur-3xl pointer-events-none`} />

              <div className="relative z-10 p-8">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border shadow-lg ${
                  orderFeedback.type === 'success'
                    ? 'bg-gradient-to-br from-success/20 to-success/10 border-success/20 text-success'
                    : 'bg-gradient-to-br from-error/20 to-error/10 border-error/20 text-error'
                }`}>
                  {orderFeedback.type === 'success' ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    >
                      <Check size={40} />
                    </motion.div>
                  ) : (
                    <AlertCircle size={40} />
                  )}
                </div>

                <h3 className={`text-3xl font-black mb-3 tracking-tight bg-gradient-to-r ${
                  orderFeedback.type === 'success'
                    ? 'from-success to-success/80'
                    : 'from-error to-error/80'
                } bg-clip-text text-transparent`}>
                  {orderFeedback.title}
                </h3>
                
                <p className="text-[var(--color-text-muted)] text-sm mb-8 leading-relaxed">
                  {orderFeedback.message}
                </p>

                {/* Order ID for success cases */}
                {orderFeedback.type === 'success' && orderFeedback.orderId && (
                  <div className="mb-6 p-3 bg-[var(--color-surface-700)]/50 rounded-xl border border-[var(--color-border)]/50">
                    <p className="text-xs text-[var(--color-text-muted)] mb-1">Número de Pedido</p>
                    <p className="font-mono font-bold text-primary">#{orderFeedback.orderId}</p>
                  </div>
                )}

                <div className="space-y-3">
                  {orderFeedback.type === 'success' && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={generatePDF}
                      className="btn btn-outline w-full rounded-2xl gap-2 h-14 border-[var(--color-border)] hover:bg-[var(--color-surface-700)] transition-all"
                    >
                      <Download size={20} /> Descargar Comprobante
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setOrderFeedback(null);
                      navigate(orderFeedback.type === 'success' ? '/' : '/pedidos');
                    }}
                    className={`btn w-full rounded-2xl font-bold h-14 transition-all ${
                      orderFeedback.type === 'success'
                        ? 'bg-success text-success-foreground hover:bg-success/90'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {orderFeedback.type === 'success' ? 'Cerrar' : 'Ver Pedidos'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
