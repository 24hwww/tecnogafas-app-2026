import {
  Bell,
  Check,
  CheckCircle,
  CheckCircle2,
  Clock,
  Filter,
  Info,
  Loader2,
  MessageSquare,
  Search,
  Send,
  UserPlus,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { PinModal } from '../components/PinModal';
import { useAuth } from '../contexts/AuthContext';
import { useNotificationsContext } from '../contexts/NotificationsContext';
import { cn, formatTimeBA, getRelativeTime } from '../lib/utils';
import { apiService } from '../services/apiService';
import type { AppNotification } from '../types';

export default function Notifications() {
  const { globalPin, setGlobalPin, currentSeller } = useAuth();
  const { sellers } = useApp();
  const {
    notifications,
    unreadNotifications,
    setUnreadNotifications,
    sendNotification,
    markAllNotificationsAsRead,
  } = useNotificationsContext();

  const [showSendForm, setShowSendForm] = useState(false);
  const [targetUser, setTargetUser] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const handleSend = async () => {
    const userId = parseInt(targetUser, 10);
    if (isNaN(userId) || !messageContent) return;

    setIsSending(true);
    const success = await sendNotification(userId, messageContent, 'message');
    setIsSending(false);

    if (success) {
      setMessageContent('');
      setShowSendForm(false);
    }
  };

  useEffect(() => {
    if (globalPin) {
      if (unreadNotifications > 0) {
        markAllNotificationsAsRead();
      }
    } else {
      setIsPinModalOpen(true);
    }
  }, [globalPin, unreadNotifications, markAllNotificationsAsRead]);

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-20">
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={(seller, pin) => setGlobalPin(pin)}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 id="notifications-title" className="text-3xl font-bold tracking-tight">
            Notificaciones
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Mensajes y alertas del sistema
          </p>
        </div>
        <button
          id="notifications-show-send-form-btn"
          onClick={() => setShowSendForm(true)}
          className="btn btn-primary rounded-2xl gap-2 shadow-lg shadow-primary/20"
        >
          <Send size={18} /> <span className="hidden sm:inline">Nuevo Mensaje</span>
        </button>
      </div>

      <AnimatePresence>
        {showSendForm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => !isSending && setShowSendForm(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Send size={20} className="text-primary" /> Nuevo Mensaje
                </h3>
                <button
                  onClick={() => setShowSendForm(false)}
                  className="btn btn-ghost btn-square btn-sm rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5">
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-[10px] font-bold uppercase tracking-widest tracking-widest opacity-60">
                      Para
                    </span>
                  </label>
                  <select
                    className="select select-bordered w-full bg-[var(--color-surface-900)] rounded-xl h-14"
                    value={targetUser}
                    onChange={(e) => setTargetUser(e.target.value)}
                  >
                    <option value="">Seleccionar Vendedor</option>
                    <option value="0">📢 Todos (Broadcast)</option>
                    {sellers
                      .filter((s) => s.id !== currentSeller?.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-[10px] font-bold uppercase tracking-widest tracking-widest opacity-60">
                      Mensaje
                    </span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered bg-[var(--color-surface-900)] w-full h-32 rounded-xl text-base font-medium"
                    placeholder="Escriba su mensaje aquí..."
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                  />
                </div>

                <button
                  id="notifications-send-btn"
                  className="btn btn-primary btn-lg w-full rounded-2xl h-16 font-bold"
                  onClick={handleSend}
                  disabled={isSending || !targetUser || !messageContent}
                >
                  {isSending ? <span className="loading loading-spinner" /> : 'Enviar Mensaje'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] border-dashed py-20 flex flex-col items-center justify-center text-center opacity-50">
            <Bell size={60} className="text-[var(--color-text-muted)] mb-4" />
            <p className="text-xl font-bold">Sin notificaciones</p>
            <p className="text-sm max-w-xs mt-2">
              No tienes mensajes ni alertas pendientes en este momento.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {notifications.map((notif: AppNotification, i: number) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  'card bg-[var(--color-surface-800)] border border-[var(--color-border)] p-5 flex flex-row items-start gap-4 hover:border-primary/30 transition-all',
                  !notif.read && 'border-primary/20 bg-primary/5',
                )}
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm',
                    notif.type === 'message'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-info/10 text-info',
                  )}
                >
                  {notif.type === 'message' ? <MessageSquare size={24} /> : <Info size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-base truncate">{notif.content.title}</h4>
                    {!notif.read && <span className="badge badge-primary badge-xs animate-pulse" />}
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed font-medium">
                    {notif.content.body}
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-[10px] font-bold uppercase tracking-widest tracking-widest opacity-40">
                    <Clock size={12} />
                    <span>{getRelativeTime(notif.created_at)}</span>
                    <span>•</span>
                    <span>{formatTimeBA(notif.created_at)} hs</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
