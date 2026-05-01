import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatTimeBA, formatDateBA } from '../lib/utils';
import { apiService } from '../services/apiService';
import { Check, X, ArrowLeft, Download, FileText, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';

export default function Checkout() {
  const { cart, selectedClient, clearCart, refreshData, saveDraft, drafts, currentDraftId, markDraftAsSent, globalPin, setGlobalPin } = useApp();
  const navigate = useNavigate();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState<{title: string, message: string, type: 'error' | 'success', orderId?: string | number} | null>(null);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sellerPin, setSellerPin] = useState('');
  const [seller, setSeller] = useState<any>(null);
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

  React.useEffect(() => {
    if (currentDraftId) {
      const draft = drafts.find(d => d.id === currentDraftId);
      if (draft && draft.details) {
        setForm(prev => ({
          ...prev,
          ...draft.details
        }));
      }
    }
  }, [currentDraftId, drafts]);

  if (!orderFeedback && (!selectedClient || cart.length === 0)) {
    return (
      <div className="p-8 text-center space-y-4 pt-20">
        <div className="w-16 h-16 bg-surface-variant/30 rounded-full flex items-center justify-center mx-auto mb-4 text-outline">
          <ArrowLeft size={32} />
        </div>
        <p className="font-bold text-on-surface">No hay datos suficientes para el checkout.</p>
        <p className="text-sm text-on-surface-variant">Regrese al carrito y seleccione un cliente y productos.</p>
        <button onClick={() => navigate('/carrito')} className="m3-button-filled w-full max-w-xs uppercase tracking-widest font-bold">Volver al Carrito</button>
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
    setIsLoading(true);
    try {
      const itemsToVerify = cart.map(item => {
        const baseProductId = parseInt(item.id.split('-')[0]);
        const verificationItem: any = {
          product_id: baseProductId,
          price: item.price,
          stock: item.quantity
        };
        if (item.vid) {
          verificationItem.variation_id = parseInt(item.vid);
        }
        return verificationItem;
      });

      const verifyRes = await apiService.verifyProducts(itemsToVerify);
      if (!verifyRes.success || (verifyRes.failed && verifyRes.failed > 0)) {
        const validationErrors: string[] = [];
        if (verifyRes.results) {
           verifyRes.results.forEach((r: any) => {
             if (r.status !== 'ok') {
               // Find original item in cart
               const originalItem = cart.find(c => {
                 const baseId = r.product_id != null ? r.product_id.toString() : '';
                 const varId = r.variation_id != null ? r.variation_id.toString() : '';
                 return baseId ? c.id.startsWith(baseId) && (!varId || c.vid === varId) : false;
               });
               const itemName = (r.variation_name ? `${r.product_name} - ${r.variation_name}` : r.product_name) || (originalItem ? originalItem.name : `Producto`);
               if (r.error) {
                 validationErrors.push(r.error);
               } else if (r.status === 'not_found') {
                  validationErrors.push(`El producto "${itemName}" ya no existe en el catálogo.`);
               } else if (r.status === 'out_of_stock' || r.status === 'insufficient_stock' || r.status === 'stock_changed' || r.status === 'both_changed') {
                  validationErrors.push(`Stock insuficiente para "${itemName}". Disponible: ${r.current_stock || 0}`);
               } else if (r.status === 'price_changed') {
                  validationErrors.push(`El precio de "${itemName}" ha cambiado de ${formatCurrency(r.verified_price)} a ${formatCurrency(r.current_price)}.`);
               } else if (r.status === 'variation_required') {
                  validationErrors.push(`El producto "${itemName}" requiere seleccionar una variación.`);
               } else {
                  validationErrors.push(`Error con "${itemName}": ${r.status}`);
               }
             }
           });
        }
        setIsConfirmModalOpen(false);
        setOrderFeedback({
          title: 'Cambios en el catálogo',
          message: "No se puede finalizar el pedido debido a los siguientes cambios:\n\n" + (validationErrors.length > 0 ? validationErrors.join("\n") : verifyRes.message),
          type: 'error'
        });
        setIsLoading(false);
        return; 
      }
      
      setIsConfirmModalOpen(false);
      if (globalPin) {
        setIsLoading(true);
        const sellerInfo = await apiService.loginSeller(globalPin);
        if (sellerInfo) {
           setSeller(sellerInfo);
           await executeCreateOrder(sellerInfo.id);
           return;
        }
      }
      setIsPinModalOpen(true);
    } catch(e) {
       console.error("Verification error", e);
       setIsConfirmModalOpen(false);
       setOrderFeedback({
         title: 'Error de conexión',
         message: 'Hubo un error al verificar los productos. Inténtelo de nuevo.',
         type: 'error'
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
        setGlobalPin(sellerPin); // <-- save to global if successful
        setIsPinModalOpen(false);
        setSeller(sellerInfo);
        await executeCreateOrder(sellerInfo.id);
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
      const orderData = {
        ...form,
        total_calc: finalTotal
      };
      
      const result = await apiService.createOrder(selectedClient!.id, cart, orderData, sellerId);
      
      if (result.success) {
        let emailMessage = '';
        if (result.orderId) {
          // Step 2: Send email and wait for detailed result as requested
          try {
            console.log("📤 Sending order notification and PDF...");
            const emailResult = await apiService.sendOrderEmail(result.orderId.toString(), sellerId);
            console.log("Email send result:", emailResult);
            emailMessage = emailResult.message || 'Correo y PDF enviados.';
          } catch (emailErr) {
            console.error("Error sending email:", emailErr);
            emailMessage = 'El pedido se creó pero hubo un error al enviar el comprobante por correo.';
          }
        }

        setLastOrder({ 
          client: selectedClient, 
          items: cart, 
          details: form, 
          total: finalTotal,
          date: new Date().toISOString() 
        });

        if (currentDraftId) {
          markDraftAsSent(currentDraftId);
        }
        
        setOrderFeedback({
          title: 'Envío exitoso',
          message: `${result.message}\n\n${emailMessage}`,
          type: 'success',
          orderId: result.orderId
        });

        clearCart();
        await refreshData();
      } else {
        // ERROR: Save as draft automatically
        saveDraft(form);
        setOrderFeedback({
          title: 'Pedido Guardado como Borrador',
          message: (result.message || 'Error al crear el pedido') + '\n\nEl pedido se ha guardado localmente como borrador para que puedas reintentarlo más tarde desde la sección de Pedidos.',
          type: 'error'
        });
      }
    } catch (e: any) {
      console.error(e);
      // ERROR: Save as draft automatically
      saveDraft(form);
      setOrderFeedback({
        title: 'Error de Conexión',
        message: (e?.message || 'Error al conectar con el servidor.') + '\n\nEl pedido se ha guardado localmente como borrador.',
        type: 'error'
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
    doc.text('Detalle de Pedido', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Cliente: ${lastOrder.client.name}`, 20, 40);
    doc.text(`Email: ${lastOrder.client.email}`, 20, 50);
    doc.text(`Fecha: ${formatDateBA(lastOrder.date)} ${formatTimeBA(lastOrder.date)} hs`, 20, 60);
    
    doc.text('Productos:', 20, 80);
    let y = 90;
    lastOrder.items.forEach((item: any) => {
      doc.text(`${item.name} x${item.quantity} - ${formatCurrency(item.price * item.quantity)}`, 30, y);
      y += 10;
    });
    
    y += 10;
    doc.text(`Subtotal: ${formatCurrency(subtotal)}`, 20, y);
    doc.text(`IVA (${lastOrder.details.iva}%): ${formatCurrency(ivaAmount)}`, 20, y + 10);
    doc.text(`Descuento: ${lastOrder.details.discount}%`, 20, y + 20);
    doc.text(`Recargo: ${lastOrder.details.recargo}%`, 20, y + 30);
    doc.setFontSize(14);
    doc.text(`TOTAL: ${formatCurrency(lastOrder.total)}`, 20, y + 45);
    
    doc.save(`pedido_${lastOrder.client.name.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/carrito')} className="p-2 bg-surface"><ArrowLeft size={20} /></button>
        <h2 className="text-2xl font-bold">Resumen de Pedido</h2>
      </div>

      <div className="m3-card !bg-surface-variant/30 space-y-4">
        <div className="flex justify-between border-b pb-2">
          <span className="text-xs font-bold uppercase text-outline">Cliente</span>
          <span className="font-medium">{selectedClient?.name || 'Procesado'}</span>
        </div>
        
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-outline">Productos</p>
          {cart.length > 0 ? cart.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.name} x{item.quantity}</span>
              <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
            </div>
          )) : (
            <div className="text-xs text-on-surface-variant italic py-2">
              Pedido procesado exitosamente
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Form Fields */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[0.625rem] font-bold uppercase text-outline tracking-widest pl-1">IVA (%)</label>
              <input 
                id="checkout-iva-input"
                type="number"
                className="w-full bg-surface-variant p-4 focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
                value={form.iva}
                onChange={e => setForm({...form, iva: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[0.625rem] font-bold uppercase text-outline tracking-widest pl-1">Descuento (%)</label>
              <input 
                id="checkout-discount-input"
                type="number"
                className="w-full bg-surface-variant p-4 focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
                value={form.discount}
                onChange={e => setForm({...form, discount: Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[0.625rem] font-bold uppercase text-outline tracking-widest pl-1">Recargo (%)</label>
              <input 
                id="checkout-recargo-input"
                type="number"
                className="w-full bg-surface-variant p-4 focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
                value={form.recargo}
                onChange={e => setForm({...form, recargo: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[0.625rem] font-bold uppercase text-outline tracking-widest pl-1">Forma de Pago</label>
              <input 
                id="checkout-methodpay-input"
                type="text"
                placeholder="Efectivo..."
                className="w-full bg-surface-variant p-4 focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
                value={form.methodpay}
                onChange={e => setForm({...form, methodpay: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[0.625rem] font-bold uppercase text-outline tracking-widest pl-1">Transporte</label>
            <input 
              id="checkout-transport-input"
              type="text"
              placeholder="Nombre del transporte"
              className="w-full bg-surface-variant p-4 focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
              value={form.transport}
              onChange={e => setForm({...form, transport: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[0.625rem] font-bold uppercase text-outline tracking-widest pl-1">Nota de Pedido</label>
            <textarea 
              id="checkout-commit-input"
              rows={2}
              className="w-full bg-surface-variant p-4 focus:ring-2 focus:ring-primary outline-none text-sm font-bold resize-none"
              placeholder="Escriba alguna observación..."
              value={form.commit}
              onChange={e => setForm({...form, commit: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[0.625rem] font-bold uppercase text-outline tracking-widest pl-1">Enviar a otro Email</label>
            <input 
              id="checkout-otheremail-input"
              type="email"
              className="w-full bg-surface-variant p-4 focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
              value={form.otheremail}
              onChange={e => setForm({...form, otheremail: e.target.value})}
            />
          </div>
        </div>
      </div>

      <div className="m3-card !bg-primary text-on-primary shadow-xl">
        <div className="flex justify-between items-center">
          <span className="font-bold">Total + IVA</span>
          <span className="text-2xl font-black">{formatCurrency(finalTotal)}</span>
        </div>
      </div>

      <div className="space-y-3">
        <button 
          id="checkout-finalize-btn"
          onClick={() => setIsConfirmModalOpen(true)}
          className="w-full m3-button-filled py-4 text-base font-bold shadow-lg"
        >
          Finalizar Pedido
        </button>

        <button 
          id="checkout-save-draft-btn"
          onClick={() => {
            saveDraft(form);
            navigate('/pedidos');
          }}
          className="w-full py-4 text-sm font-bold border-2 border-outline/20 flex items-center justify-center gap-2 hover:bg-surface-variant transition-colors"
        >
          <FileText size={18} />
          Guardar Pedido
        </button>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsConfirmModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-surface w-full max-w-xs p-6 shadow-2xl text-center space-y-4"
            >
              <h3 className="text-xl font-bold">¿Confirmar Pedido?</h3>
              <p className="text-sm text-on-surface-variant">Se enviará el pedido al sistema central.</p>
              <div className="flex flex-col gap-2 pt-4">
                <button 
                  id="checkout-confirm-modal-no-btn"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="flex-1 py-3 bg-surface-variant font-bold"
                >
                  No
                </button>
                <button 
                  id="checkout-confirm-modal-yes-btn"
                  onClick={handleConfirmOrder}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-primary text-on-primary font-bold flex items-center justify-center"
                >
                  {isLoading ? '...' : 'Si'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PIN Modal */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-surface w-full max-w-xs p-8 shadow-2xl text-center space-y-6 border border-white/10"
            >
              <div className="w-16 h-16 bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <FileText size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold uppercase tracking-tight">PIN Vendedor</h3>
                <p className="text-xs text-outline">Ingrese su código para autorizar el pedido.</p>
              </div>
              
              <div className="space-y-4">
                <input 
                  id="checkout-pin-input"
                  type="password"
                  inputMode="numeric"
                  placeholder="••••••••"
                  maxLength={8}
                  className="w-full bg-surface-variant p-4 text-center text-3xl tracking-[0.6rem] font-black focus:ring-2 focus:ring-primary outline-none"
                  value={sellerPin}
                  onChange={e => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setSellerPin(value);
                  }}
                  autoFocus
                />
                
                {pinError && <p className="text-xs font-bold text-red-400 uppercase tracking-widest">{pinError}</p>}
                
                <div className="flex flex-col gap-2 pt-2">
                  <button 
                    id="checkout-pin-modal-cancel-btn"
                    onClick={() => setIsPinModalOpen(false)}
                    className="flex-1 py-3 bg-surface-variant font-bold text-sm"
                  >
                    CANCELAR
                  </button>
                  <button 
                    id="checkout-pin-modal-validate-btn"
                    onClick={handleValidatePin}
                    disabled={isLoading || sellerPin.length !== 8}
                    className="flex-1 py-3 bg-primary text-on-primary font-bold text-sm flex items-center justify-center"
                  >
                    {isLoading ? '...' : 'VALIDAR'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sending Order Modal */}
      <AnimatePresence>
        {isSendingOrder && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface p-8 shadow-2xl text-center space-y-4 border border-primary/20 flex flex-col items-center"
            >
              <RefreshCw className="w-12 h-12 text-primary animate-spin" />
              <h3 className="text-lg font-bold tracking-widest uppercase">Enviando pedido...</h3>
              <p className="text-sm text-on-surface-variant">Por favor espere mientras procesamos su solicitud.</p>
            </motion.div>          </div>
        )}
      </AnimatePresence>

      {/* Order Feedback Modal */}
      <AnimatePresence>
        {orderFeedback && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative bg-surface w-full max-w-sm p-8 shadow-2xl text-center space-y-6 border ${orderFeedback.type === 'success' ? 'border-green-500/50' : 'border-red-500/50'}`}
            >
              <div className={`w-16 h-16 flex items-center justify-center mx-auto rounded-full ${orderFeedback.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {orderFeedback.type === 'success' ? <Check size={32} /> : <X size={32} />}
              </div>
              <div className="space-y-4">
                <h3 className={`text-xl font-bold uppercase tracking-tight ${orderFeedback.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{orderFeedback.title === 'Envío exitoso' ? '✅ ENVÍO EXITOSO' : orderFeedback.title}</h3>
                <div className={`text-sm text-left p-4 rounded whitespace-pre-wrap max-h-64 overflow-y-auto ${orderFeedback.type === 'success' ? 'bg-green-500/5 text-on-surface' : 'bg-red-500/5 text-on-surface'}`}>
                  {orderFeedback.message}
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                {orderFeedback.type === 'success' ? (
                  <>
                    <button
                      onClick={() => {
                        setOrderFeedback(null);
                        navigate('/pedidos', { state: { highlightOrderId: orderFeedback.orderId } });
                      }}
                      className="w-full py-4 font-bold text-sm tracking-widest bg-primary text-on-primary shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-transform"
                    >
                      <FileText size={20} />
                      VER DETALLES DEL PEDIDO
                    </button>                    
                    <button 
                      onClick={() => {
                        setOrderFeedback(null);
                        navigate('/pedidos');
                      }}
                      className="w-full py-4 font-bold text-sm tracking-widest bg-surface-variant text-on-surface flex items-center justify-center gap-3 active:scale-95 transition-transform"
                    >
                      <ArrowLeft size={18} />
                      IR A TODOS LOS PEDIDOS
                    </button>
                    
                    <button 
                      onClick={() => {
                        setOrderFeedback(null);
                        navigate('/');
                      }}
                      className="w-full py-3 text-xs font-bold uppercase tracking-widest text-outline hover:text-primary transition-colors mt-2"
                    >
                      FINALIZAR Y VOLVER AL INICIO
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setOrderFeedback(null)}
                    className="w-full py-4 font-bold text-sm tracking-widest bg-red-500 text-white"
                  >
                    ENTENDIDO
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
