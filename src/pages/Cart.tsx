import { AlertCircle, Camera, Copy, Share2, ShoppingBag, Trash2, User, Plus, Minus, ArrowRight, Package } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PinModal } from '../components/PinModal';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { formatCurrency, cn } from '../lib/utils';
import type { Seller } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function Cart() {
  const { cart, selectedClient, removeFromCart, updateCartQuantity, shareCart, clearCart } =
    useCart();
  const { globalPin, setGlobalPin } = useAuth();
  const navigate = useNavigate();
  const [isSharing, setIsSharing] = useState(false);
  const [shareResult, setShareResult] = useState<{
    success: boolean;
    code: string;
    message: string;
    link: string;
  } | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleConfirm = () => {
    navigate('/pago');
  };

  const handleShareCart = async () => {
    if (!selectedClient || cart.length === 0) {
      alert('Debes tener productos en el carrito y un cliente asignado para compartir');
      return;
    }
    if (!globalPin) {
      setIsPinModalOpen(true);
      return;
    }
    executeShareCart();
  };

  const executeShareCart = async () => {
    setIsSharing(true);
    try {
      const result = await shareCart();
      setShareResult(result);
      if (result.success && navigator.clipboard) {
        await navigator.clipboard.writeText(result.link);
      }
    } catch (error) {
      console.error('Error sharing cart:', error);
      setShareResult({ success: false, code: '', message: 'Error al compartir carrito', link: '' });
    } finally {
      setIsSharing(false);
    }
  };

  const handlePinSuccess = async (seller: Seller, pin: string) => {
    setGlobalPin(pin);
    setIsPinModalOpen(false);
    await executeShareCart();
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (confirm('¿Estás seguro de que quieres limpiar todo el carrito?')) {
      clearCart();
    }
  };

  const generateCartImage = async (shareCode?: string) => {
    if (cart.length === 0) return;
    setIsGeneratingImage(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      const QRCode = (await import('qrcode')).default;

      const displayCode = typeof shareCode === 'string' ? shareCode : `LOCAL_${Date.now().toString(36).toUpperCase()}`;
      const shareUrl = typeof shareCode === 'string'
        ? `${window.location.origin}/shared-cart/${shareCode}`
        : `${window.location.origin}/carrito?recover=${displayCode}`;

      const qrCodeDataUrl = await QRCode.toDataURL(shareUrl, {
        width: 150,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      });

      const currentDate = new Date().toLocaleDateString('es-AR');
      const cartItemsHtml = cart
        .map(
          (item) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #000; font-size: 11px;">${item.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #000; font-size: 11px; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #000; font-size: 11px; text-align: right;">${formatCurrency(item.price * item.quantity)}</td>
        </tr>
      `,
        )
        .join('');

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: white; width: 550px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="margin: 0; color: #000; font-size: 22px; font-weight: bold;">PEDIDO TECNOGAFAS</h1>
            <p style="margin: 5px 0; color: #000; font-size: 14px;">Fecha: ${currentDate}</p>
            <p style="margin: 2px 0; color: #444; font-size: 12px;">Código: ${displayCode}</p>
          </div>
          ${selectedClient ? `
          <div style="margin-bottom: 20px; padding: 12px; border: 1px solid #000; border-radius: 4px;">
            <h2 style="margin: 0 0 5px 0; color: #000; font-size: 14px; font-weight: bold;">CLIENTE</h2>
            <p style="margin: 0; font-weight: bold; color: #000; font-size: 15px;">${selectedClient.name}</p>
            ${selectedClient.email ? `<p style="margin: 3px 0 0 0; color: #444; font-size: 12px;">${selectedClient.email}</p>` : ''}
          </div>
          ` : ''}
          <div style="margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="padding: 8px; border: 1px solid #000; text-align: left; font-size: 12px;">Producto</th>
                  <th style="padding: 8px; border: 1px solid #000; text-align: center; font-size: 12px;">Cant.</th>
                  <th style="padding: 8px; border: 1px solid #000; text-align: right; font-size: 12px;">Subtotal</th>
                </tr>
              </thead>
              <tbody>${cartItemsHtml}</tbody>
            </table>
          </div>
          <div style="text-align: right; margin-top: 15px; padding: 10px; border-top: 2px solid #000;">
            <h2 style="margin: 0; font-size: 20px; font-weight: bold; color: #000;">TOTAL: ${formatCurrency(total)}</h2>
          </div>
          <div style="text-align: center; margin-top: 25px; padding: 15px; border: 1px dashed #666; border-radius: 8px;">
            <p style="margin: 0 0 10px 0; color: #000; font-size: 13px; font-weight: bold;">ESCANEAR PARA RECUPERAR PEDIDO</p>
            <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 140px; height: 140px;" />
          </div>
        </div>
      `;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      const canvas = await html2canvas(tempDiv, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`pedido-tecnogafas-${Date.now()}.pdf`);
      document.body.removeChild(tempDiv);
    } catch (error) {
      console.error('Error generating cart PDF:', error);
      alert('Error al generar el PDF del pedido');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="cart-title" className="text-3xl font-bold tracking-tight">Carrito</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Revisa y confirma tu pedido</p>
        </div>
        {cart.length > 0 && (
          <button
            id="cart-clear-all-btn"
            onClick={handleClearCart}
            className="btn btn-ghost btn-sm text-error gap-2 hover:bg-error/10"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">Limpiar todo</span>
          </button>
        )}
      </div>

      {/* Selected Client Section */}
      <div className={cn(
        "card bg-[var(--color-surface-800)] border border-[var(--color-border)] p-5 relative overflow-hidden",
        !selectedClient && "border-warning/30 bg-warning/5"
      )}>
        <div className="flex items-start justify-between relative z-10">
          <div className="flex gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
              selectedClient ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
            )}>
              <User size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                Cliente Asociado
              </p>
              {selectedClient ? (
                <div>
                  <p className="text-lg font-bold">{selectedClient.name}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">{selectedClient.email}</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-warning">
                  <AlertCircle size={16} />
                  <p className="text-sm font-medium">Asigna un cliente para continuar</p>
                </div>
              )}
            </div>
          </div>
          <button
            id="cart-change-client-btn"
            onClick={() => navigate('/clientes')}
            className={cn(
              "btn btn-sm rounded-xl",
              selectedClient ? "btn-ghost text-primary" : "btn-warning text-white"
            )}
          >
            {selectedClient ? 'Cambiar' : 'Asignar'}
          </button>
        </div>
      </div>

      {/* Cart Items */}
      <div className="space-y-4">
        {cart.length === 0 ? (
          <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] border-dashed py-20 flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 bg-[var(--color-surface-900)] rounded-full flex items-center justify-center mb-6 border border-[var(--color-border)]">
              <ShoppingBag size={40} className="text-[var(--color-text-muted)] opacity-50" />
            </div>
            <h3 className="text-xl font-bold">Tu carrito está vacío</h3>
            <p className="text-[var(--color-text-muted)] mt-2 max-w-xs">
              Agrega productos del catálogo para comenzar un nuevo pedido.
            </p>
            <button
              onClick={() => navigate('/productos')}
              className="btn btn-primary mt-8 gap-2 px-8"
            >
              Ir al Catálogo <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] p-4 flex flex-row items-center gap-4 hover:border-primary/30 transition-all group"
              >
                <div className="w-16 h-16 bg-[var(--color-surface-900)] rounded-xl flex items-center justify-center shrink-0 border border-[var(--color-border)]">
                  <Package className="text-[var(--color-text-muted)]" size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm sm:text-base truncate">{item.name}</h4>
                  <p className="text-xs text-[var(--color-text-muted)] font-medium">
                    {formatCurrency(item.price)} <span className="opacity-50">c/u</span>
                  </p>
                  
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center bg-[var(--color-surface-900)] rounded-lg p-0.5 border border-[var(--color-border)]">
                      <button
                        id={`cart-decrease-qty-btn-${item.id}`}
                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                        className="btn btn-ghost btn-square btn-xs hover:bg-primary/10 hover:text-primary"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-bold text-xs">{item.quantity}</span>
                      <button
                        id={`cart-increase-qty-btn-${item.id}`}
                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                        className="btn btn-ghost btn-square btn-xs hover:bg-primary/10 hover:text-primary"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      id={`cart-remove-item-btn-${item.id}`}
                      onClick={() => removeFromCart(item.id)}
                      className="btn btn-ghost btn-square btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <button
          id="cart-add-products-btn"
          onClick={() => navigate('/productos')}
          className="w-full btn btn-ghost border-2 border-dashed border-[var(--color-border)] hover:border-primary/50 hover:bg-primary/5 rounded-2xl py-8 h-auto"
        >
          <div className="flex flex-col items-center gap-2">
            <Plus size={24} className="text-primary" />
            <span className="font-bold text-[var(--color-text-muted)]">Agregar más productos</span>
          </div>
        </button>
      )}

      {/* Summary Floating Bar */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-surface-900)]/90 backdrop-blur-xl border-t border-[var(--color-border)] p-4 lg:p-6 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)]"
          >
            <div className="max-w-3xl mx-auto flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Total Estimado</p>
                  <p className="text-3xl font-black text-primary leading-none mt-1">{formatCurrency(total)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleShareCart}
                    disabled={isSharing}
                    className="btn btn-square btn-outline btn-lg rounded-2xl"
                    title="Compartir"
                  >
                    {isSharing ? <span className="loading loading-spinner loading-sm" /> : <Share2 size={22} />}
                  </button>
                  <button
                    onClick={() => generateCartImage()}
                    disabled={isGeneratingImage}
                    className="btn btn-square btn-outline btn-lg rounded-2xl"
                    title="PDF"
                  >
                    {isGeneratingImage ? <span className="loading loading-spinner loading-sm" /> : <Camera size={22} />}
                  </button>
                </div>
              </div>
              
              <button
                id="cart-confirm-order-btn"
                onClick={handleConfirm}
                disabled={!selectedClient}
                className="btn btn-primary btn-lg w-full rounded-2xl font-bold text-lg h-16 shadow-lg shadow-primary/20"
              >
                Continuar al Pago <ArrowRight size={20} className="ml-2" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Result Modal */}
      <AnimatePresence>
        {shareResult && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
                shareResult.success ? "bg-success/10 text-success" : "bg-error/10 text-error"
              )}>
                {shareResult.success ? <ShoppingBag size={40} /> : <AlertCircle size={40} />}
              </div>
              
              <h3 className="text-2xl font-bold mb-2">
                {shareResult.success ? '¡Carrito Guardado!' : 'Error al guardar'}
              </h3>
              <p className="text-[var(--color-text-muted)] text-sm mb-8">
                {shareResult.message}
              </p>

              {shareResult.success && (
                <div className="bg-[var(--color-surface-900)] p-6 rounded-2xl border border-[var(--color-border)] mb-8 space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Código de recuperación</p>
                    <code className="text-3xl font-black tracking-widest text-primary">{shareResult.code}</code>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareResult.link);
                      alert('Enlace copiado');
                    }}
                    className="btn btn-ghost btn-sm w-full gap-2 text-primary"
                  >
                    <Copy size={16} /> Copiar enlace directo
                  </button>
                </div>
              )}

              <button
                onClick={() => setShareResult(null)}
                className="btn btn-primary w-full h-14 rounded-2xl font-bold text-lg"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
      />
    </div>
  );
}
