// ============================================================================
// CHAT TEST - Componente para probar conexión con Supabase
// ============================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../modules/chat/lib/supabase';

export default function ChatTest() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [realtimeMessage, setRealtimeMessage] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  // Test 0: Verificar autenticación
  const checkAuth = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    setCurrentUser(user);
    console.log('👤 Usuario Supabase:', user);
    console.log('🔑 Auth UID:', user?.id);
    if (error) console.error('❌ Error auth:', error);
    return user;
  };

  const AuthBadge = () => {
    if (!currentUser) return <span className="text-xs text-on-surface-variant italic">No autenticado</span>;
    return (
      <span className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded-lg font-mono">
        {currentUser.email}
      </span>
    );
  };

  // Test 1: Verificar conexión
  const testConnection = async () => {
    setStatus('testing');
    setError(null);
    
    // Verificar auth primero
    const user = await checkAuth();
    if (!user) {
      // Intentar auto-login con el PIN actual
      const pin = localStorage.getItem('tecnogafas_pin');
      if (pin) {
        setError('Sincronizando sesión Supabase con PIN: ' + pin + '...');
        const { apiService } = await import('../services/apiService');
        const res = await apiService.syncSupabaseAuth(pin);
        if (res.error) {
           setStatus('error');
           setError('No hay sesión y falló el auto-login: ' + res.error);
           return;
        }
        // Reintentar
        testConnection();
        return;
      }
      
      setStatus('error');
      setError('No hay sesión de Supabase y no se encontró un PIN configurado.');
      return;
    }
    
    try {
      const { data, error } = await supabase.from('conversations').select('*').limit(1);
      
      if (error) throw error;
      
      setStatus('success');
      console.log('✅ Conexión exitosa:', data);
    } catch (err: any) {
      setStatus('error');
      setError(err.message);
      console.error('❌ Error de conexión:', err);
    }
  };

  // Test 2: Cargar mensajes
  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      setMessages(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Test 3: Enviar mensaje
  const sendTestMessage = async () => {
    if (!newMessage.trim()) return;
    
    // Verificar autenticación primero
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setError('❌ No autenticado en Supabase. Auth UID: ' + (user?.id || 'null'));
      console.error('Auth error:', authError);
      return;
    }
    console.log('✅ Autenticado como:', user.id);
    
    try {
      // Primero buscar una conversación
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .limit(1)
        .returns<{ id: string }[]>()
        .single();
      
      if (convError) {
        console.error('Error buscando conversación:', convError);
      }
      
      if (!conv) {
        setError('No hay conversaciones. Crea una primero en SQL.');
        return;
      }
      
      const { data: msgData, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conv.id,
          content: newMessage,
          type: 'text'
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('❌ Error insertando mensaje:', insertError);
        throw insertError;
      }
      
      setNewMessage('');
      loadMessages();
      console.log('✅ Mensaje enviado:', msgData);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Test 4: Realtime subscription
  useEffect(() => {
    const subscription = supabase
      .channel('test-messages')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('📨 Mensaje en tiempo real:', payload);
          setRealtimeMessage(payload.new);
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Test 5: Simular notificación de sistema (Bridge)
  const sendSystemNotification = async () => {
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('slug', 'notificaciones')
        .single();
      
      if (!conv) {
        setError('Canal #notificaciones no encontrado. Ejecuta el SQL primero.');
        return;
      }

      const { data, error } = await supabase.rpc('send_notification_to_chat', {
        p_title: '🧪 Test Sistema',
        p_message: 'Esta es una notificación de prueba desde el Bridge',
        p_type: 'system',
        p_priority: 'normal'
      });

      if (error) throw error;
      console.log('✅ Notificación enviada vía RPC:', data);
      loadMessages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-6 bg-surface rounded-2xl border border-outline/20 max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-on-surface">🧪 Test de Chat</h2>
      
      {/* Status */}
      <div className="flex items-center gap-3">
        <span className="text-on-surface-variant">Estado:</span>
        <span className={`
          px-3 py-1 rounded-full text-sm font-medium
          ${status === 'idle' ? 'bg-surface-variant text-on-surface-variant' : ''}
          ${status === 'testing' ? 'bg-primary-container text-on-primary-container' : ''}
          ${status === 'success' ? 'bg-green-100 text-green-700' : ''}
          ${status === 'error' ? 'bg-error-container text-on-error-container' : ''}
        `}>
          {status === 'idle' && '⏸️ Sin probar'}
          {status === 'testing' && '⏳ Probando...'}
          {status === 'success' && '✅ Conectado'}
          {status === 'error' && '❌ Error'}
        </span>
        <AuthBadge />
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-error-container rounded-xl text-on-error-container">
          <p className="font-medium">Error:</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Botones de test */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={testConnection}
          className="px-4 py-2 bg-primary text-on-primary rounded-xl hover:opacity-90 transition-opacity"
        >
          1. Probar Conexión
        </button>
        
        <button
          onClick={loadMessages}
          className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-xl hover:opacity-90 transition-opacity"
        >
          2. Cargar Mensajes
        </button>

        <button
          onClick={sendSystemNotification}
          className="px-4 py-2 bg-tertiary text-on-tertiary rounded-xl hover:opacity-90 transition-opacity"
        >
          4. Simular Notificación (Bridge)
        </button>
      </div>

      {/* Enviar mensaje */}
      <div className="space-y-3">
        <h3 className="font-medium text-on-surface">3. Enviar mensaje de prueba</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 px-4 py-2 bg-surface-variant rounded-xl text-on-surface placeholder:text-on-surface-variant outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => e.key === 'Enter' && sendTestMessage()}
          />
          <button
            onClick={sendTestMessage}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl hover:opacity-90 transition-opacity"
          >
            Enviar
          </button>
        </div>
      </div>

      {/* Realtime indicator */}
      {realtimeMessage && (
        <div className="p-4 bg-tertiary-container rounded-xl">
          <p className="text-sm text-on-tertiary-container">
            📨 Mensaje en tiempo real recibido:
          </p>
          <p className="font-medium text-on-tertiary-container">
            {realtimeMessage.content}
          </p>
        </div>
      )}

      {/* Lista de mensajes */}
      {messages.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-on-surface">Mensajes recientes:</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className="p-3 bg-surface-variant rounded-xl"
              >
                <p className="text-on-surface">{msg.content}</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  {new Date(msg.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug info */}
      <details className="text-sm">
        <summary className="text-on-surface-variant cursor-pointer">
          Información de debug
        </summary>
        <div className="mt-2 p-3 bg-surface-variant rounded-xl text-on-surface-variant font-mono text-xs">
          <p>Supabase URL: {import.meta.env.VITE_SUPABASE_URL || 'NO CONFIGURADO'}</p>
          <p>Anon Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Configurado' : '❌ No configurado'}</p>
        </div>
      </details>
    </div>
  );
}
