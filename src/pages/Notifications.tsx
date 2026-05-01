import { useEffect, useState } from 'react';
import { Bell, Info, Loader2, Send, MessageSquare, Check, UserPlus, X, Clock, CheckCircle2 } from 'lucide-react';
import { getRelativeTime, formatTimeBA } from '../lib/utils';
import { useApp } from '../AppContext';
import { apiService } from '../services/apiService';
import { PinModal } from '../components/PinModal';
import { motion, AnimatePresence } from 'motion/react';

export default function Notifications() {
  const { globalPin, setGlobalPin, sellers, currentSeller, notifications, setNotifications, unreadNotifications, setUnreadNotifications, fetchNotifications, sendNotification } = useApp();
  
  const [showSendForm, setShowSendForm] = useState(false);
  const [targetUser, setTargetUser] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isAcking, setIsAcking] = useState<any[]>([]);

  const handleSend = async () => {
    const userId = parseInt(targetUser, 10);
    if (isNaN(userId) || !messageContent) return;

    setIsSending(true);
    const success = await sendNotification(userId, messageContent, 'message');
    setIsSending(false);

    if (success) {
      setMessageContent('');
      setShowSendForm(false);
      fetchNotifications();
    }
  };

  useEffect(() => {
    if (globalPin) {
      fetchNotifications();
      if (unreadNotifications > 0) {
        setUnreadNotifications(0);
      }
    } else {
      setIsPinModalOpen(true);
    }
  }, [globalPin, fetchNotifications, unreadNotifications, setUnreadNotifications]);

  return (
    <div className="space-y-4 pb-20">
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={(seller, pin) => {
          setGlobalPin(pin);
          fetchNotifications();
        }}
      />

      <div className="flex justify-between items-center">
        <h2 id="notifications-title" className="text-2xl font-bold">Notificaciones</h2>
        <button
          id="notifications-show-send-form-btn"
          onClick={() => setShowSendForm(!showSendForm)}
          className="m3-button !p-2 rounded-full"
        >
          <Send size={20} />
        </button>
      </div>

      <AnimatePresence>
        {showSendForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface p-6 shadow-2xl w-full max-w-sm space-y-4 border border-outline/10 rounded-2xl"
            >
              <h3 id="notifications-new-title" className="font-bold flex items-center gap-2 text-primary text-lg">
                <Send size={18} /> Enviar Mensaje
              </h3>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant">Para:</label>
                <select 
                  className="w-full p-3 m3-input rounded-xl border border-outline/20 bg-surface text-sm"
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                >
                  <option value="">Seleccionar Vendedor</option>
                  <option value="0">Todos (Broadcast)</option>
                  {sellers.filter(s => s.id !== currentSeller?.id).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant">Mensaje:</label>
                <textarea 
                  className="w-full p-3 m3-input rounded-xl border border-outline/20 bg-surface text-sm h-24"
                  placeholder="Escribe tu mensaje aquí..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  id="notifications-close-send-form-btn"
                  className="flex-1 py-3 font-bold text-sm bg-surface-variant text-on-surface rounded-xl"
                  onClick={() => setShowSendForm(false)}
                >
                  Cancelar
                </button>
                <button 
                  id="notifications-send-btn"
                  className="flex-1 py-3 font-bold text-sm bg-primary text-on-primary rounded-xl disabled:opacity-50"
                  onClick={handleSend}
                  disabled={isSending || !targetUser || !messageContent}
                >
                  {isSending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Listado de notificaciones */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center py-10 text-on-surface-variant opacity-60">
            <Bell size={48} className="mx-auto mb-2" />
            <p className="text-sm font-bold">No hay notificaciones</p>
          </div>
        ) : (
          notifications.map((notif: any) => (
            <motion.div 
              key={notif.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="m3-card !p-4 flex items-start gap-3"
            >
              <div className={`mt-1 p-2 rounded-full ${notif.read ? 'bg-surface-variant text-outline' : 'bg-primary/10 text-primary'}`}>
                {notif.type === 'message' ? <MessageSquare size={18} /> : <Info size={18} />}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm">{notif.content.title}</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">{notif.content.body}</p>
                <span className="text-[0.625rem] text-outline block mt-2 font-mono">
                  {formatTimeBA(notif.created_at)}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
