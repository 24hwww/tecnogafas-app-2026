import { useApp } from '../AppContext';
import { Trash2, AlertCircle, ShoppingBag, User, Share2, Copy, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';
import { useState } from 'react';
import { PinModal } from '../components/PinModal';
import { Seller } from '../types';
import React from 'react';

export default function Cart() {
  const { cart, selectedClient, removeFromCart, updateCartQuantity, shareCart, globalPin, setGlobalPin, clearCart } = useApp();
  const navigate = useNavigate();
  const [isSharing, setIsSharing] = useState(false);
  const [shareResult, setShareResult] = useState<{ success: boolean; code: string; message: string; link: string } | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Debug: Log para depurar qué datos recibe el Cart
  console.log('Cart Component - cart:', cart);
  console.log('Cart Component - selectedClient:', selectedClient);

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleConfirm = () => {
    navigate('/pago');
  };

  const handleShareCart = async () => {
    if (!selectedClient || cart.length === 0) {
      alert('Debes tener productos en el carrito y un cliente asignado para compartir');
      return;
    }

    // Check if PIN is already validated
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
      
      if (result.success) {
        // Copy link to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(result.link);
          alert('¡Carrito compartido! El enlace ha sido copiado al portapapeles.');
        }

        // Try native share API
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Carrito Tecnogafas',
              text: `Mira mi carrito: ${result.link}`,
              url: result.link
            });
          } catch (shareError) {
            console.log('Native share failed:', shareError);
          }
        }
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
    
    if (confirm('¿Estás seguro de que quieres limpiar todo el carrito? Esta acción no se puede deshacer.')) {
      clearCart();
      alert('Carrito limpiado exitosamente');
    }
  };

  const generateCartImage = async () => {
    if (cart.length === 0) return;
    
    setIsGeneratingImage(true);
    try {
      // Importar librerías dinámicamente
      const jsPDF = (await import('jspdf')).jsPDF;
      const html2canvas = (await import('html2canvas')).default;
      const QRCode = (await import('qrcode')).default;
      
      // Generar código QR único para el carrito
      const cartId = `cart_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const qrCodeData = {
        id: cartId,
        client: selectedClient ? { name: selectedClient.name, email: selectedClient.email } : null,
        items: cart,
        total: total,
        date: new Date().toISOString(),
        version: '1.0'
      };
      
      // Guardar QR data en localStorage para recuperación después
      localStorage.setItem(`qr_cart_${cartId}`, JSON.stringify(qrCodeData));
      
      // Generar QR code
      const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrCodeData), {
        width: 150,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      // Generar HTML del carrito
      const currentDate = new Date().toLocaleDateString('es-AR');
      const cartItemsHtml = cart.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #000; font-size: 12px;">${item.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #000; font-size: 12px;">${formatCurrency(item.price)} c/u × ${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #000; font-size: 12px; text-align: right; font-weight: bold;">${formatCurrency(item.price * item.quantity)}</td>
        </tr>
      `).join('');
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: white;">
          <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="margin: 0; color: #000; font-size: 20px; font-weight: bold;">PEDIDO TECNOGAFAS</h1>
            <p style="margin: 5px 0; color: #000; font-size: 12px;">${currentDate}</p>
          </div>
          
          ${selectedClient ? `
          <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #000;">
            <h2 style="margin: 0 0 8px 0; color: #000; font-size: 16px; font-weight: bold;">CLIENTE</h2>
            <p style="margin: 0; font-weight: bold; color: #000; font-size: 14px;">${selectedClient.name}</p>
            ${selectedClient.email ? `<p style="margin: 5px 0 0 0; color: #000; font-size: 12px;">${selectedClient.email}</p>` : ''}
          </div>
          ` : ''}
          
          <div style="margin-bottom: 20px;">
            <h2 style="margin: 0 0 12px 0; color: #000; font-size: 16px; font-weight: bold;">PRODUCTOS</h2>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
              <thead>
                <tr>
                  <th style="padding: 8px; border: 1px solid #000; text-align: left; font-size: 12px;">Producto</th>
                  <th style="padding: 8px; border: 1px solid #000; text-align: left; font-size: 12px;">Cantidad</th>
                  <th style="padding: 8px; border: 1px solid #000; text-align: right; font-size: 12px;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${cartItemsHtml}
              </tbody>
            </table>
          </div>
          
          <div style="text-align: right; margin-top: 20px; padding: 15px; border-top: 2px solid #000;">
            <h2 style="margin: 0; font-size: 18px; font-weight: bold; color: #000;">TOTAL: ${formatCurrency(total)}</h2>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding: 20px; border: 2px dashed #000;">
            <h3 style="margin: 0 0 10px 0; color: #000; font-size: 14px; font-weight: bold;">ESCANEAR PARA RECUPERAR PEDIDO</h3>
            <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 150px; height: 150px;" />
            <p style="margin: 10px 0 0 0; color: #000; font-size: 12px;">ID: ${cartId}</p>
            <p style="margin: 5px 0; color: #666; font-size: 10px;">Escanea este código QR con la app para recuperar este pedido</p>
          </div>
        </div>
      `;
      
      // Generar PDF con jsPDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Convertir HTML a canvas y luego a imagen para el PDF
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      document.body.appendChild(tempDiv);
      
      // Generar canvas del contenido
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      // Agregar imagen al PDF
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 190; // Ancho en mm para A4
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      
      // Descargar PDF
      pdf.save(`pedido-tecnogafas-${Date.now()}.pdf`);
      
      // Limpiar
      document.body.removeChild(tempDiv);
      
      alert('PDF del pedido generado y descargado');
      
    } catch (error) {
      console.error('Error generating cart PDF:', error);
      alert('Error al generar el PDF del pedido');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h2 id="cart-title" className="text-2xl font-bold">Carrito</h2>
        {cart.length > 0 && (
          <button 
            id="cart-clear-all-btn"
            onClick={handleClearCart}
            className="text-sm text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
          >
            <Trash2 size={16} />
            Limpiar todo
          </button>
        )}
      </div>

      {/* Selected Client Section */}
      <div className="m3-card !bg-primary-container/20 border-primary/20">
        <h3 className="text-xs font-bold text-primary flex items-center gap-1 mb-2">
          <User size={14} /> CLIENTE ASOCIADO
        </h3>
        {selectedClient ? (
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold">{selectedClient.name}</p>
              <p className="text-xs text-on-surface-variant">{selectedClient.email}</p>
            </div>
            <button id="cart-change-client-btn" onClick={() => navigate('/clientes')} className="text-xs text-primary font-bold">Cambiar</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle size={20} />
              <span className="text-xs font-medium">Asigna un cliente para continuar</span>
            </div>
            <button id="cart-assign-client-btn" onClick={() => navigate('/clientes')} className="m3-button-filled w-full">Asignar</button>
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div className="space-y-3">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 border-2 border-dashed border-outline/20 rounded-2xl">
            <div className="bg-surface-variant p-4 rounded-full">
              <ShoppingBag size={48} className="text-outline" />
            </div>
            <h3 className="font-bold">Carrito Vacío</h3>
            <p className="text-xs text-on-surface-variant">Agrega productos del catálogo para comenzar un pedido.</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="m3-card flex gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm">{item.name}</h4>
                <p className="text-xs text-on-surface-variant">{formatCurrency(item.price)} c/u</p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center bg-surface px-2 py-1 border border-outline/10">
                    <button id={`cart-decrease-qty-btn-${item.id}`} onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="p-1">
                      <span className="text-lg font-bold">−</span>
                    </button>
                    <span className="mx-3 font-bold text-xs">{item.quantity}</span>
                    <button id={`cart-increase-qty-btn-${item.id}`} onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="p-1">
                      <span className="text-lg font-bold">+</span>
                    </button>
                  </div>
                  <button id={`cart-remove-item-btn-${item.id}`} onClick={() => removeFromCart(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="text-right flex flex-col justify-between items-end">
                <span className="font-bold text-primary">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        id="cart-add-products-btn"
        onClick={() => navigate('/productos')}
        className="w-full text-center text-sm font-bold text-primary py-4 border-2 border-primary border-dashed rounded-xl hover:bg-primary/5 transition-colors"
      >
        + Agregar {cart.length === 0 ? 'productos' : 'más productos'}
      </button>

      {/* Share Result Modal */}
      {shareResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold mb-4">
              {shareResult.success ? '✅ ¡Carrito Compartido!' : '❌ Error al Compartir'}
            </h3>
            {shareResult.success ? (
              <React.Fragment>
                <div className="space-y-3">
                  <p className="text-green-600 font-medium">{shareResult.message}</p>
                  <div className="bg-gray-100 p-3 rounded border">
                    <p className="text-sm font-bold mb-2">Código del carrito:</p>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-3 py-2 rounded font-mono text-lg">{shareResult.code}</code>
                      <button 
                        onClick={() => navigator.clipboard.writeText(shareResult.link)}
                        className="m3-button-outlined text-sm"
                      >
                        <Copy size={16} className="mr-1" />
                        Copiar
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Enlace público: <a href={shareResult.link} target="_blank" className="text-blue-600 underline">{shareResult.link}</a>
                  </p>
                  <p className="text-xs text-gray-500">Este enlace expirará en 24 horas.</p>
                </div>
                <button 
                  onClick={() => setShareResult(null)}
                  className="w-full m3-button-filled mt-4"
                >
                  Cerrar
                </button>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div className="space-y-3">
                  <p className="text-red-600 font-medium">{shareResult.message}</p>
                  <div className="space-y-2">
                    <button 
                      onClick={generateCartImage}
                      disabled={isGeneratingImage || cart.length === 0}
                      className="w-full m3-button-outlined flex items-center justify-center gap-2"
                    >
                      {isGeneratingImage ? (
                        <>
                          <div className="inline-block animate-spin rounded-full border-2 border-primary/20 border-t-primary/20 h-4 w-4"></div>
                          Generando PDF...
                        </>
                      ) : (
                        <>
                          <Camera size={16} />
                          Generar PDF del pedido
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => setShareResult(null)}
                      className="w-full m3-button-filled"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
      )}

      {/* Summary and Action */}
      <div className="m3-card !bg-surface sticky bottom-0 border-t-2 border-primary/10 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.3)] -mx-4 px-4 py-6 space-y-4 z-10">
        <div className="flex justify-between items-center">
          <span className="text-lg font-medium">Total</span>
          <span className="text-2xl font-bold text-primary">{formatCurrency(total)}</span>
        </div>
        <div className="space-y-3">
          <button 
            id="cart-share-cart-btn"
            onClick={handleShareCart}
            disabled={!selectedClient || cart.length === 0 || isSharing}
            className="w-full m3-button-outlined py-3 disabled:opacity-50"
          >
            {isSharing ? (
              <>
                <div className="inline-block animate-spin rounded-full border-2 border-primary/20 border-t-primary/20 h-4 w-4 mr-2"></div>
                Guardando y Compartiendo...
              </>
            ) : (
              <>
                <Share2 size={18} className="mr-2" />
                Guardar y Compartir Carrito
              </>
            )}
          </button>
          <button 
            id="cart-confirm-order-btn"
            onClick={handleConfirm}
            disabled={!selectedClient || cart.length === 0}
            className="w-full m3-button-filled py-3 disabled:opacity-50"
          >
            Confirmar Pedido
          </button>
        </div>
      </div>
    {/* PIN Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
      />
    </div>
  );
}
