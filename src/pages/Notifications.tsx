import { useEffect, useState } from 'react';
import { Bell, Info, Loader2, Send, MessageSquare, Check, UserPlus } from 'lucide-react';
import { useApp } from '../AppContext';
import { apiService } from '../services/apiService';
import { PinModal } from '../components/PinModal';
import { motion, AnimatePresence } from 'motion/react';

export default function Notifications() {
  const { globalPin, setGlobalPin, sellers, currentSeller, unreadNotifications, setUnreadNotifications, sendNotification } = useApp();
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  
  // Send message states
  const [showSendForm, setShowSendForm] = useState(false);
  const [targetUser, setTargetUser] = useState<string>('');
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getEvents(undefined, globalPin || undefined);
      setEvents(data);
      setError(null);
      
      // If we are looking at them, we can assume they are read or the user will ack them
      if (unreadNotifications > 0) {
        // Option: ack all visible? For now just reset local count if any
      }
    } catch (err: any) {
      if (err.message.includes('401')) {
         setIsPinModalOpen(true);
         setError('Sesión expirada. Por favor ingrese su PIN.');
      } else {
         setError(err.message || 'Error al cargar eventos');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAck = async (id: number) => {
    if (!globalPin) return;
    try {
      await apiService.ackEvent(id, globalPin);
      setEvents(prev => prev.map(e => e.id === id ? { ...e, read: true } : e));
      setUnreadNotifications(Math.max(0, unreadNotifications - 1));
    } catch (e) {
      console.error('Failed to ack event', e);
    }
  };

  const handleSend = async () => {
    if (!targetUser || !messageContent) return;
    
    setIsSending(true);
    const success = await sendNotification(parseInt(targetUser), messageContent, 'message');
    setIsSending(false);
    
    if (success) {
      setMessageContent('');
      setShowSendForm(false);
      fetchEvents(); // Refresh to see sent message if backend supports it
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [globalPin]);

  // Handle real-time updates: if unreadCount changes, refresh list
  useEffect(() => {
    if (unreadNotifications > 0) {
      fetchEvents();
    }
  }, [unreadNotifications]);

  return (
    <div className="space-y-4 pb-20">
      <PinModal 
        isOpen={isPinModalOpen} 
        onClose={() => setIsPinModalOpen(false)} 
        onSuccess={(seller, pin) => {
          setGlobalPin(pin);
          fetchEvents();
        }}
      />
      
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Notificaciones</h2>
        <button 
          onClick={() => setShowSendForm(!showSendForm)}
          className="m3-button !p-2 rounded-full"
        >
          <UserPlus size={20} />
        </button>
      </div>

      <AnimatePresence>
        {showSendForm && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="m3-card !bg-primary/5 space-y-3 overflow-hidden"
          >
            <h3 className="font-bold flex items-center gap-2 text-primary">
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
                className="flex-1 m3-button-outlined"
                onClick={() => setShowSendForm(false)}
              >
                Cancelar
              </button>
              <button 
                className="flex-1 m3-button disabled:opacity-50"
                onClick={handleSend}
                disabled={!targetUser || !messageContent || isSending}
              >
                {isSending ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Enviar'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="space-y-3">
        {isLoading && events.length === 0 ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : error ? (
          <div className="text-center p-4 text-red-500 bg-red-500/10 rounded-xl">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center p-12 text-on-surface-variant bg-surface-variant/30 rounded-3xl border-2 border-dashed border-outline/10">
            <Bell size={48} className="mx-auto mb-4 opacity-10" />
            <p className="font-medium">No hay notificaciones</p>
            <p className="text-xs opacity-60">Las alertas y mensajes aparecerán aquí.</p>
          </div>
        ) : (
          events.map((n, i) => {
            const isRead = n.read || n.status === 'read';
            const content = typeof n.content === 'string' ? n.content : n.content?.text || n.message || n.details || '';
            const sender = n.content?.sender || n.sender_name || 'Sistema';

            return (
              <motion.div 
                key={n.id || i} 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className={`m3-card border-l-4 ${isRead ? 'border-outline/10' : 'border-primary bg-primary/5'} !p-4 flex gap-4 items-start`}
              >
                <div className={`p-2 rounded-full ${
                  n.type === 'message' ? 'bg-purple-100 text-purple-600' :
                  n.type === 'success' ? 'bg-green-100 text-green-600' : 
                  n.type === 'warning' ? 'bg-orange-100 text-orange-600' : 
                  'bg-blue-100 text-blue-600'
                }`}>
                  {n.type === 'message' ? <MessageSquare size={18} /> : <Bell size={18} />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className={`font-bold text-sm ${isRead ? 'text-on-surface' : 'text-primary'}`}>
                      {sender} • {n.title || (n.type === 'message' ? 'Mensaje' : 'Notificación')}
                    </h4>
                    <span className="text-[0.625rem] text-on-surface-variant font-medium">
                      {n.timestamp ? new Date(n.timestamp).toLocaleString() : n.time || ''}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{content}</p>
                  
                  {!isRead && (
                    <button 
                      onClick={() => handleAck(n.id)}
                      className="mt-3 flex items-center gap-1 text-[0.625rem] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-1 rounded"
                    >
                      <Check size={12} /> Marcar como leída
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="bg-primary/5 p-4 rounded-3xl flex items-center gap-3 border border-primary/10">
        <Info size={20} className="text-primary shrink-0" />
        <p className="text-xs font-medium text-on-surface-variant leading-tight">
          Recibirás sonidos y notificaciones push en tiempo real incluso con la aplicación en segundo plano.
        </p>
      </div>
    </div>
  );
}
