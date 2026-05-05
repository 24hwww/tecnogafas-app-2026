-- ============================================================================
-- TRIGGERS PARA INTEGRACIÓN PEDIDOS -> CHAT
-- Cuando se crea un pedido, enviar notificación al chat automáticamente
-- ============================================================================

-- ============================================================================
-- FUNCIÓN: Crear mensaje de pedido en el chat
-- ============================================================================

CREATE OR REPLACE FUNCTION create_order_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  target_conversation_id UUID;
  order_creator_id UUID;
  order_message_content TEXT;
  order_metadata JSONB;
  channel_conversation_id UUID;
BEGIN
  -- Buscar el canal #pedidos o #general donde enviar la notificación
  -- Prioridad: #pedidos > #general > primera conversación pública
  
  SELECT id INTO channel_conversation_id
  FROM conversations
  WHERE slug = 'pedidos' AND is_archived = FALSE
  LIMIT 1;
  
  IF channel_conversation_id IS NULL THEN
    SELECT id INTO channel_conversation_id
    FROM conversations
    WHERE slug = 'general' AND is_archived = FALSE
    LIMIT 1;
  END IF;
  
  IF channel_conversation_id IS NULL THEN
    -- Si no hay canal general, buscar cualquier conversación pública
    SELECT id INTO channel_conversation_id
    FROM conversations
    WHERE is_private = FALSE AND is_archived = FALSE
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  -- Si no hay ninguna conversación, salir sin error
  IF channel_conversation_id IS NULL THEN
    RAISE NOTICE 'No hay conversación disponible para notificar el pedido';
    RETURN NEW;
  END IF;

  -- Construir el contenido del mensaje
  order_message_content := format(
    '📦 Nuevo pedido #%s - Total: $%s',
    COALESCE(NEW.order_number, NEW.id::text),
    COALESCE(NEW.total::text, '0.00')
  );
  
  -- Si hay estado, agregarlo
  IF NEW.status IS NOT NULL THEN
    order_message_content := order_message_content || format(' - Estado: %s', NEW.status);
  END IF;

  -- Construir metadata del pedido
  order_metadata := jsonb_build_object(
    'order_id', NEW.id,
    'order_number', COALESCE(NEW.order_number, NEW.id::text),
    'status', COALESCE(NEW.status, 'pending'),
    'total', COALESCE(NEW.total, 0),
    'customer_name', COALESCE(NEW.customer_name, 'Cliente'),
    'customer_email', NEW.customer_email,
    'items_count', COALESCE(NEW.items_count, 0),
    'url', format('/orders/%s', NEW.id)
  );

  -- Insertar el mensaje en el chat
  INSERT INTO messages (
    conversation_id,
    user_id,
    type,
    content,
    content_html,
    order_data,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    channel_conversation_id,
    NULL, -- Mensaje del sistema (sin user_id específico)
    'order',
    order_message_content,
    format('<div class="order-card"><strong>📦 Pedido #%s</strong><br>Total: $%s<br>Estado: %s<br><a href="/orders/%s">Ver detalles</a></div>',
      COALESCE(NEW.order_number, NEW.id::text),
      COALESCE(NEW.total::text, '0.00'),
      COALESCE(NEW.status, 'pending'),
      NEW.id
    ),
    order_metadata,
    jsonb_build_object(
      'notification_type', 'new_order',
      'auto_generated', true,
      'source_table', 'orders'
    ),
    NOW(),
    NOW()
  );

  -- El trigger de mensajes (increment_conversation_message_count) actualizará 
  -- automáticamente el contador y last_message_at de la conversación
  
  RAISE NOTICE 'Mensaje de pedido creado en conversación %', channel_conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Ejecutar cuando se inserta un nuevo pedido
-- ============================================================================

-- IMPORTANTE: Ajusta 'orders' al nombre real de tu tabla de pedidos
DROP TRIGGER IF EXISTS on_order_created_chat_notification ON orders;

CREATE TRIGGER on_order_created_chat_notification
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_order_chat_message();

-- ============================================================================
-- FUNCIÓN ADICIONAL: Notificar cambios de estado del pedido
-- ============================================================================

CREATE OR REPLACE FUNCTION create_order_status_update_message()
RETURNS TRIGGER AS $$
DECLARE
  channel_conversation_id UUID;
  status_emoji TEXT;
BEGIN
  -- Solo procesar si cambió el estado
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Seleccionar emoji según estado
  status_emoji := CASE NEW.status
    WHEN 'completed' THEN '✅'
    WHEN 'shipped' THEN '🚚'
    WHEN 'processing' THEN '⚙️'
    WHEN 'cancelled' THEN '❌'
    WHEN 'pending' THEN '⏳'
    ELSE '📦'
  END;

  -- Buscar conversación
  SELECT id INTO channel_conversation_id
  FROM conversations
  WHERE slug IN ('pedidos', 'general') AND is_archived = FALSE
  ORDER BY slug = 'pedidos' DESC
  LIMIT 1;

  IF channel_conversation_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insertar mensaje de actualización
  INSERT INTO messages (
    conversation_id,
    user_id,
    type,
    content,
    order_data,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    channel_conversation_id,
    NULL,
    'system',
    format('%s Pedido #%s actualizado: %s → %s', 
      status_emoji,
      COALESCE(NEW.order_number, NEW.id::text),
      COALESCE(OLD.status, 'desconocido'),
      NEW.status
    ),
    jsonb_build_object(
      'order_id', NEW.id,
      'order_number', COALESCE(NEW.order_number, NEW.id::text),
      'previous_status', OLD.status,
      'new_status', NEW.status,
      'updated_at', NOW()
    ),
    jsonb_build_object(
      'notification_type', 'order_status_update',
      'auto_generated', true
    ),
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para cambios de estado
DROP TRIGGER IF EXISTS on_order_status_update_chat_notification ON orders;

CREATE TRIGGER on_order_status_update_chat_notification
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_order_status_update_message();

-- ============================================================================
-- INSTRUCCIONES DE USO
-- ============================================================================

/*

1. AJUSTAR NOMBRE DE TABLA:
   Si tu tabla de pedidos se llama diferente (ej: 'pedidos', 'sales', 'invoices'),
   reemplaza 'orders' en las líneas:
   - DROP TRIGGER IF EXISTS ... ON orders;
   - CREATE TRIGGER ... ON orders;

2. AJUSTAR COLUMNAS:
   Si tus columnas tienen nombres diferentes, modifica:
   - NEW.order_number → NEW.numero_pedido, etc.
   - NEW.total → NEW.monto_total, etc.
   - NEW.customer_name → NEW.cliente_nombre, etc.

3. ELEGIR CANAL DESTINO:
   Por defecto busca: #pedidos → #general → cualquier canal público
   Para usar un canal específico, modifica la consulta:
   
   SELECT id INTO channel_conversation_id
   FROM conversations
   WHERE id = 'UUID-DE-TU-CONVERSACION';

4. PERMISOS:
   Este trigger usa SECURITY DEFINER para ejecutarse con permisos elevados.
   Asegúrate de que el rol 'postgres' o 'service_role' tenga acceso a ambas tablas.

5. VERIFICAR FUNCIONAMIENTO:
   Después de ejecutar, crea un pedido de prueba:
   
   INSERT INTO orders (order_number, total, status, customer_name)
   VALUES ('TEST-001', 999.99, 'pending', 'Cliente Test');
   
   Y verifica que aparezca el mensaje en el chat.

*/
