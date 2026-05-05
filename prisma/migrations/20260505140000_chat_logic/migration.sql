-- ============================================================================
-- CHAT SYSTEM LOGIC: FUNCTIONS, TRIGGERS, RLS & VIEWS
-- ============================================================================

-- 1. Helper: updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Message Counters: Actualizar conversaciones al insertar mensajes
CREATE OR REPLACE FUNCTION public.increment_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_message_count ON public.messages;
CREATE TRIGGER trigger_increment_message_count
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_conversation_message_count();

-- 3. Unread Counts: Incrementar contador de no leídos para otros miembros
CREATE OR REPLACE FUNCTION public.update_unread_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversation_members
  SET
    unread_count = unread_count + 1,
    updated_at = NOW()
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_unread_counts ON public.messages;
CREATE TRIGGER trigger_update_unread_counts
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_unread_counts();

-- 4. Function: send_notification_to_chat (Universal Notification Bridge)
CREATE OR REPLACE FUNCTION public.send_notification_to_chat(
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'system',
  p_metadata JSONB DEFAULT '{}',
  p_action_url TEXT DEFAULT NULL,
  p_action_label TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal'
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
  FROM public.conversations
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
  INSERT INTO public.messages (
    conversation_id,
    user_id,
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
  
  RETURN v_message_id;
END;
$$;

-- 5. Realtime Publication Setup
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- 6. Views for Chat
CREATE OR REPLACE VIEW public.conversation_list AS
SELECT
  c.*,
  cm.role,
  cm.unread_count,
  cm.last_read_at,
  cm.is_muted,
  cm.is_pinned
FROM public.conversations c
JOIN public.conversation_members cm
  ON cm.conversation_id = c.id
WHERE cm.user_id = auth.uid();

CREATE OR REPLACE VIEW public.message_details AS
WITH reaction_stats AS (
  SELECT
    mr.message_id,
    mr.emoji,
    COUNT(DISTINCT mr.user_id) AS reaction_count,
    jsonb_agg(DISTINCT mr.user_id) AS users
  FROM public.message_reactions mr
  GROUP BY mr.message_id, mr.emoji
)
SELECT
  m.*,
  p.username AS author_username,
  p.display_name AS author_display_name,
  p.avatar_url AS author_avatar_url,
  array_agg(DISTINCT rs.emoji) FILTER (WHERE rs.emoji IS NOT NULL) AS reactions,
  jsonb_object_agg(rs.emoji, jsonb_build_object('count', rs.reaction_count, 'users', rs.users)) FILTER (WHERE rs.emoji IS NOT NULL) AS reaction_details
FROM public.messages m
LEFT JOIN public.profiles p ON p.id = m.user_id
LEFT JOIN reaction_stats rs ON rs.message_id = m.id
WHERE m.is_deleted = FALSE
GROUP BY m.id, p.username, p.display_name, p.avatar_url;
