-- ============================================================================
-- SISTEMA UNIFICADO: NOTIFICACIONES + CHAT
-- Todas las notificaciones llegan como mensajes al canal #notificaciones
-- Cada mensaje es reaccionable (tipo WhatsApp)
-- ============================================================================

-- ============================================================================
-- 1. CREAR CANAL DE NOTIFICACIONES (si no existe)
-- ============================================================================

DO $$
DECLARE
  notif_channel_id UUID;
  system_user_id UUID;
BEGIN
  -- Buscar o crear canal #notificaciones
  SELECT id INTO notif_channel_id
  FROM conversations
  WHERE slug = 'notificaciones' AND is_archived = FALSE
  LIMIT 1;
  
  IF notif_channel_id IS NULL THEN
    -- Obtener un usuario admin para crear el canal
    SELECT id INTO system_user_id
    FROM profiles
    LIMIT 1;
    
    IF system_user_id IS NULL THEN
      RAISE EXCEPTION 'No hay usuarios para crear el canal de notificaciones';
    END IF;
    
    INSERT INTO conversations (type, slug, name, description, created_by, is_private, settings)
    VALUES (
      'channel', 
      'notificaciones', 
      'Notificaciones', 
      'Todas las notificaciones del sistema: pedidos, alertas, mensajes importantes',
      system_user_id,
      FALSE,
      '{"allow_reactions": true, "slow_mode": 0}'::jsonb
    )
    RETURNING id INTO notif_channel_id;
    
    -- Agregar a todos los usuarios existentes al canal
    INSERT INTO conversation_members (conversation_id, user_id, role, notifications)
    SELECT notif_channel_id, id, 'member', '{"all": true, "mentions": true, "replies": true}'::jsonb
    FROM profiles;
    
    RAISE NOTICE 'Canal #notificaciones creado con ID: %', notif_channel_id;
  END IF;
END $$;

-- ============================================================================
-- 2. FUNCIÓN: Enviar notificación al chat (universal)
-- ============================================================================

CREATE OR REPLACE FUNCTION send_notification_to_chat(
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'system', -- 'order', 'alert', 'system', 'notification'
  p_metadata JSONB DEFAULT '{}',
  p_action_url TEXT DEFAULT NULL,
  p_action_label TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal' -- 'low', 'normal', 'high', 'urgent'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
  v_message_id UUID;
  v_content_html TEXT;
  v_alert_data JSONB;
  v_order_data JSONB;
BEGIN
  -- Buscar canal #notificaciones
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE slug = 'notificaciones' AND is_archived = FALSE
  LIMIT 1;
  
  IF v_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Canal #notificaciones no encontrado';
  END IF;
  
  -- Construir HTML según tipo
  v_content_html := CASE p_type
    WHEN 'order' THEN format(
      '<div class="notification-order"><strong>%s</strong><br>%s</div>',
      p_title, p_message
    )
    WHEN 'alert' THEN format(
      '<div class="notification-alert notification-%s"><strong>%s</strong><br>%s</div>',
      COALESCE(p_metadata->>'level', 'info'), p_title, p_message
    )
    ELSE format(
      '<div class="notification-system"><strong>%s</strong><br>%s</div>',
      p_title, p_message
    )
  END CASE;
  
  -- Preparar datos específicos según tipo
  IF p_type = 'alert' THEN
    v_alert_data := jsonb_build_object(
      'level', COALESCE(p_metadata->>'level', 'info'),
      'title', p_title,
      'priority', p_priority,
      'action', CASE WHEN p_action_url IS NOT NULL THEN 
        jsonb_build_object('label', COALESCE(p_action_label, 'Ver'), 'url', p_action_url)
      ELSE NULL END
    );
  ELSIF p_type = 'order' THEN
    v_order_data := p_metadata;
  END IF;
  
  -- Insertar mensaje en el chat
  INSERT INTO messages (
    conversation_id,
    user_id,        -- NULL = mensaje del sistema
    type,
    content,
    content_html,
    order_data,
    alert_data,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    v_conversation_id,
    NULL,
    p_type,
    format('%s: %s', p_title, p_message),
    v_content_html,
    v_order_data,
    v_alert_data,
    jsonb_build_object(
      'notification_type', p_type,
      'priority', p_priority,
      'auto_generated', true,
      'action_url', p_action_url,
      'action_label', p_action_label,
      'source', p_metadata->>'source'
    ),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_message_id;
  
  -- Los triggers automáticos harán:
  -- 1. Actualizar last_message_at de la conversación
  -- 2. Incrementar unread_count de los miembros
  -- 3. Notificar vía Realtime a todos los clientes conectados
  
  RAISE NOTICE 'Notificación enviada al chat: % (mensaje ID: %)', p_title, v_message_id;
  
  RETURN v_message_id;
END;
$$;

-- ============================================================================
-- 3. TRIGGER MEJORADO: Pedidos → Notificación Chat
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_order_to_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_name TEXT;
  v_items_count INTEGER;
  v_action_url TEXT;
BEGIN
  -- Obtener datos adicionales si existen
  v_customer_name := COALESCE(NEW.customer_name, 'Cliente');
  v_items_count := COALESCE(NEW.items_count, 0);
  v_action_url := format('/orders/%s', NEW.id);
  
  -- Enviar notificación usando la función universal
  PERFORM send_notification_to_chat(
    format('📦 Pedido #%s', COALESCE(NEW.order_number, NEW.id::text)),
    format('%s - Total: $%s - %s items', 
      v_customer_name,
      COALESCE(NEW.total::text, '0.00'),
      v_items_count
    ),
    'order',
    jsonb_build_object(
      'order_id', NEW.id,
      'order_number', COALESCE(NEW.order_number, NEW.id::text),
      'status', COALESCE(NEW.status, 'pending'),
      'total', COALESCE(NEW.total, 0),
      'customer_name', v_customer_name,
      'items_count', v_items_count,
      'url', v_action_url
    ),
    v_action_url,
    'Ver pedido',
    CASE NEW.status
      WHEN 'urgent' THEN 'urgent'
      WHEN 'cancelled' THEN 'high'
      ELSE 'normal'
    END
  );
  
  RETURN NEW;
END;
$$;

-- Trigger para nuevos pedidos
DROP TRIGGER IF EXISTS tr_order_created_notify_chat ON orders;
CREATE TRIGGER tr_order_created_notify_chat
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_to_chat();

-- Trigger para cambios de estado en pedidos
CREATE OR REPLACE FUNCTION notify_order_status_change_to_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emoji TEXT;
  v_action_url TEXT;
BEGIN
  -- Solo si cambió el status
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Emoji según estado
  v_emoji := CASE NEW.status
    WHEN 'completed' THEN '✅'
    WHEN 'shipped' THEN '🚚'
    WHEN 'processing' THEN '⚙️'
    WHEN 'cancelled' THEN '❌'
    WHEN 'pending' THEN '⏳'
    ELSE '📦'
  END CASE;
  
  v_action_url := format('/orders/%s', NEW.id);
  
  PERFORM send_notification_to_chat(
    format('%s Pedido #%s actualizado', v_emoji, COALESCE(NEW.order_number, NEW.id::text)),
    format('Estado: %s → %s', COALESCE(OLD.status, '-'), NEW.status),
    'system',
    jsonb_build_object(
      'order_id', NEW.id,
      'previous_status', OLD.status,
      'new_status', NEW.status
    ),
    v_action_url,
    'Ver pedido',
    CASE 
      WHEN NEW.status = 'cancelled' THEN 'high'
      WHEN NEW.status = 'completed' THEN 'normal'
      ELSE 'low'
    END
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_order_status_changed_notify_chat ON orders;
CREATE TRIGGER tr_order_status_changed_notify_chat
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_status_change_to_chat();

-- ============================================================================
-- 4. EJEMPLOS DE USO MANUAL (para otros eventos)
-- ============================================================================

/*

-- Enviar alerta de inventario bajo:
SELECT send_notification_to_chat(
  '⚠️ Stock bajo',
  'El producto "iPhone 15" tiene solo 3 unidades',
  'alert',
  '{"level": "warning", "product_id": "123"}'::jsonb,
  '/inventory/123',
  'Gestionar stock',
  'high'
);

-- Enviar notificación de nuevo usuario:
SELECT send_notification_to_chat(
  '👤 Nuevo usuario registrado',
  'Juan Pérez (juan@email.com) se ha registrado',
  'system',
  '{"user_id": "uuid", "source": "auth"}'::jsonb,
  '/users/uuid',
  'Ver perfil'
);

-- Enviar recordatorio:
SELECT send_notification_to_chat(
  '📅 Recordatorio',
  'Tienes una cita programada para mañana',
  'notification',
  '{"appointment_id": "xyz"}'::jsonb,
  '/appointments/xyz',
  'Ver detalles'
);

*/

-- ============================================================================
-- 5. VISTA: Resumen de notificaciones por usuario
-- ============================================================================

CREATE OR REPLACE VIEW user_notifications_summary AS
SELECT 
  cm.user_id,
  c.id as conversation_id,
  c.name as channel_name,
  COUNT(m.id) FILTER (WHERE m.created_at > cm.last_read_at) as unread_notifications,
  MAX(m.created_at) as last_notification_at,
  jsonb_agg(
    DISTINCT jsonb_build_object(
      'id', m.id,
      'type', m.type,
      'content', LEFT(m.content, 100),
      'created_at', m.created_at
    )
  ) FILTER (WHERE m.created_at > cm.last_read_at) as recent_notifications
FROM conversation_members cm
JOIN conversations c ON c.id = cm.conversation_id
LEFT JOIN messages m ON m.conversation_id = c.id AND m.user_id IS NULL  -- Solo mensajes del sistema
WHERE c.slug = 'notificaciones'
GROUP BY cm.user_id, c.id, c.name;

-- ============================================================================
-- INSTRUCCIONES
-- ============================================================================

/*

INSTALACIÓN:
1. Ejecutar este archivo en Supabase Dashboard > SQL Editor
2. Verificar que se creó el canal #notificaciones
3. Los triggers automáticos enviarán pedidos y cambios de estado

PERSONALIZACIÓN:
- Cambiar 'orders' por el nombre de tu tabla de pedidos
- Modificar los mensajes en las funciones notify_order_to_chat
- Agregar más campos a los mensajes según necesites

USO DESDE TU BACKEND:
Para enviar notificaciones manualmente desde tu API:

const { data, error } = await supabase.rpc('send_notification_to_chat', {
  p_title: '📦 Nuevo pedido',
  p_message: 'Cliente X ordenó $500',
  p_type: 'order',
  p_metadata: { order_id: '123', total: 500 },
  p_action_url: '/orders/123',
  p_priority: 'normal'
});

*/
