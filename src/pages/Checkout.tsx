import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';
import { apiService } from '../services/apiService';
import { Check, X, ArrowLeft, Download, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';

export default function Checkout() {
  const { cart, selectedClient, clearCart, refreshData, saveDraft, drafts, currentDraftId, markDraftAsSent } = useApp();
  const navigate = useNavigate();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
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

  if (!selectedClient || cart.length === 0) {
    return (
      <div className="p-8 text-center space-y-4">
        <p>No hay datos suficientes para el checkout.</p>
        <button onClick={() => navigate('/carrito')} className="m3-button-filled">Volver al Carrito</button>
      </div>
    );
  }

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discountAmount = (subtotal * (Number(form.discount) || 0)) / 100;
  const recargoAmount = (subtotal * (Number(form.recargo) || 0)) / 100;
  const baseForIva = subtotal - discountAmount + recargoAmount;
  const ivaAmount = (baseForIva * (Number(form.iva) || 0)) / 100;
  const finalTotal = baseForIva + ivaAmount;

  const handleConfirmOrder = () => {
    setIsConfirmModalOpen(false);
    setIsPinModalOpen(true);
  };

  const handleValidatePin = async () => {
    if (!sellerPin) return;
    setIsLoading(true);
    setPinError('');
    try {
      const sellerInfo = await apiService.loginSeller(sellerPin);
      if (sellerInfo) {
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
    setIsLoading(true);
    try {
      const orderData = {
        ...form,
        total_calc: finalTotal
      };
      const result = await apiService.createOrder(selectedClient!.id, cart, orderData, sellerId);
      if (result.success) {
        setLastOrder({ 
          client: selectedClient, 
          items: cart, 
          details: form, 
          total: finalTotal,
          date: new Date().toISOString() 
        });
        setIsPinModalOpen(false);
        if (currentDraftId) {
          markDraftAsSent(currentDraftId);
        }
        clearCart();
        await refreshData();
        alert(result.message || 'Envío de pedido exitoso');
        navigate('/pedidos');
      } else {
        alert(result.message || 'Error al crear el pedido');
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Error de conexión');
    } finally {
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
    doc.text(`Fecha: ${new Date(lastOrder.date).toLocaleString()}`, 20, 60);
    
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
          <span className="font-medium">{selectedClient.name}</span>
        </div>
        
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-outline">Productos</p>
          {cart.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.name} x{item.quantity}</span>
              <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Form Fields */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-outline tracking-widest pl-1">IVA (%)</label>
              <input 
                type="number"
                className="w-full bg-surface-variant p-4 focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
                value={form.iva}
                onChange={e => setForm({...form, iva: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-outline tracking-widest pl-1">Descuento (%)</label>
              <input 
                type="number"
                className="w-full bg-surface-variant p-4 focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
                value={form.discount}
                onChange={e => setForm({...form, discount: Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-outline tracking-widest pl-1">Recargo (%)</label>
              <input 
                type="number"
                className="w-full bg-surface-variant p-4 focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
                value={form.recargo}
                onChange={e => setForm({...form, recargo: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-outline tracking-widest pl-1">Forma de Pago</label>
              <input 
                type="text"
                placeholder="Efectivo..."
                className="w-full bg-surface-variant p-4 focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
                value={form.methodpay}
                onChange={e => setForm({...form, methodpay: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-outline tracking-widest pl-1">Transporte</label>
            <input 
              type="text"
              placeholder="Nombre del transporte"
              className="w-full bg-surface-variant p-4 focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
              value={form.transport}
              onChange={e => setForm({...form, transport: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-outline tracking-widest pl-1">Nota de Pedido</label>
            <textarea 
              rows={2}
              className="w-full bg-surface-variant p-4 focus:ring-2 focus:ring-primary outline-none text-sm font-bold resize-none"
              placeholder="Escriba alguna observación..."
              value={form.commit}
              onChange={e => setForm({...form, commit: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-outline tracking-widest pl-1">Enviar a otro Email</label>
            <input 
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
          onClick={() => setIsConfirmModalOpen(true)}
          className="w-full m3-button-filled py-4 text-base font-bold shadow-lg"
        >
          Finalizar Pedido
        </button>

        <button 
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
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="flex-1 py-3 bg-surface-variant font-bold"
                >
                  No
                </button>
                <button 
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
                  type="password"
                  inputMode="numeric"
                  placeholder="••••••••"
                  maxLength={8}
                  className="w-full bg-surface-variant p-4 text-center text-3xl tracking-[0.6rem] font-black focus:ring-2 focus:ring-primary outline-none"
                  value={sellerPin}
                  onChange={e => setSellerPin(e.target.value)}
                  autoFocus
                />
                
                {pinError && <p className="text-xs font-bold text-red-400 uppercase tracking-widest">{pinError}</p>}
                
                <div className="flex gap-4 pt-2">
                  <button 
                    onClick={() => setIsPinModalOpen(false)}
                    className="flex-1 py-3 bg-surface-variant font-bold text-sm"
                  >
                    CANCELAR
                  </button>
                  <button 
                    onClick={handleValidatePin}
                    disabled={isLoading || !sellerPin}
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

    </div>
  );
}
