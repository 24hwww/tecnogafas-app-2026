-- ============================================================================
-- SISTEMA DE CHAT REALTIME CON SUPABASE
-- Arquitectura: Discord + Slack + Telegram hybrid
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABLA: PROFILES (extensión de auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'dnd', 'offline')),
  status_message TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para profiles
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen_at);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. TABLA: CONVERSATIONS (canales y chats privados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('channel', 'group', 'direct')),
  slug TEXT UNIQUE, -- para canales públicos tipo #general
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_private BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{
    "slow_mode": 0,
    "allow_reactions": true,
    "allow_threads": true,
    "allow_editing": true,
    "allow_deleting": true
  }',
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices optimizados para conversaciones
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_slug ON conversations(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(is_archived) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_conversations_metadata ON conversations USING GIN(metadata);

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. TABLA: CONVERSATION_MEMBERS (miembros de conversaciones)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count INTEGER DEFAULT 0,
  is_muted BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  notifications JSONB DEFAULT '{
    "all": true,
    "mentions": true,
    "replies": true
  }',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Índices críticos para performance
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv ON conversation_members(conversation_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_conversation_members_unread ON conversation_members(user_id, unread_count) WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS idx_conversation_members_last_read ON conversation_members(user_id, last_read_at);

CREATE TRIGGER update_conversation_members_updated_at
  BEFORE UPDATE ON conversation_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. TABLA: MESSAGES (mensajes del chat)
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES messages(id) ON DELETE CASCADE, -- para threads/replies
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- NULL para mensajes del sistema
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'system', 'order', 'alert', 'media', 'file', 'voice', 'poll')),
  content TEXT NOT NULL,
  content_html TEXT, -- versión renderizada con markdown/links
  metadata JSONB DEFAULT '{}',
  -- Para mensajes tipo orden/alerta
  order_data JSONB,
  alert_data JSONB,
  -- Para archivos adjuntos
  attachments JSONB DEFAULT '[]',
  -- Contadores denormalizados para performance
  reply_count INTEGER DEFAULT 0,
  reaction_count INTEGER DEFAULT 0,
  -- Estado
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices ultra-optimizados para mensajes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_type ON messages(conversation_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id, created_at) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_type_system ON messages(type, created_at) WHERE type = 'system';
CREATE INDEX IF NOT EXISTS idx_messages_metadata ON messages USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_messages_order_data ON messages USING GIN(order_data) WHERE order_data IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_search ON messages USING GIN(to_tsvector('spanish', content));

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. TABLA: MESSAGE_REACTIONS (reacciones emoji)
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL, -- emoji unicode o shortcode :heart:
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_id);

-- ============================================================================
-- 6. TABLA: MESSAGE_READS (estado de lectura por usuario)
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reads_message ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON message_reads(user_id);

-- ============================================================================
-- 7. TABLA: TYPING_STATUS (indicador de "escribiendo...")
-- ============================================================================
CREATE TABLE IF NOT EXISTS typing_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 seconds',
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_typing_status_conversation ON typing_status(conversation_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_typing_status_expires ON typing_status(expires_at);

-- Función para auto-limpiar typing status expirado
CREATE OR REPLACE FUNCTION cleanup_expired_typing()
RETURNS void AS $$
BEGIN
  DELETE FROM typing_status WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. TABLA: USER_PRESENCE (estado online/offline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'dnd', 'offline')),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  device_info JSONB DEFAULT '{}',
  ip_address INET,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status, last_active_at);

-- ============================================================================
-- FUNCTIONS & TRIGGERS AVANZADOS
-- ============================================================================

-- Función para incrementar contador de mensajes en conversación
CREATE OR REPLACE FUNCTION increment_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET message_count = message_count + 1,
      last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_message_count
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_conversation_message_count();

-- Función para actualizar unread count de miembros
CREATE OR REPLACE FUNCTION update_unread_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversation_members
  SET unread_count = unread_count + 1,
      updated_at = NOW()
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.user_id
    AND last_read_at < NEW.created_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_unread_counts
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_unread_counts();

-- Función para actualizar reply_count del mensaje padre
CREATE OR REPLACE FUNCTION update_parent_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    UPDATE messages 
    SET reply_count = reply_count + 1
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reply_count
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_parent_reply_count();

-- Función para actualizar reaction_count
CREATE OR REPLACE FUNCTION update_message_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE messages SET reaction_count = reaction_count + 1 WHERE id = NEW.message_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE messages SET reaction_count = reaction_count - 1 WHERE id = OLD.message_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reaction_count_insert
  AFTER INSERT ON message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_message_reaction_count();

CREATE TRIGGER trigger_update_reaction_count_delete
  AFTER DELETE ON message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_message_reaction_count();

-- Función para crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW()
  );
  
  INSERT INTO user_presence (user_id, status, last_active_at)
  VALUES (NEW.id, 'offline', NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Profiles: Users can read all profiles but only update their own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" 
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Conversations: Members can view, owners/admins can update
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversations viewable by members" 
  ON conversations FOR SELECT 
  USING (
    NOT is_private OR 
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = conversations.id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Conversations creatable by authenticated" 
  ON conversations FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Conversations updatable by owners/admins" 
  ON conversations FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = conversations.id 
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Conversation Members: Viewable by members, self-modifiable
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation members viewable by members" 
  ON conversation_members FOR SELECT 
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM conversation_members cm2
      WHERE cm2.conversation_id = conversation_members.conversation_id
      AND cm2.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join public conversations" 
  ON conversation_members FOR INSERT 
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = conversation_id 
      AND NOT is_private
    )
  );

CREATE POLICY "Users can update own membership" 
  ON conversation_members FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can leave conversations" 
  ON conversation_members FOR DELETE 
  USING (user_id = auth.uid());

-- Messages: Viewable by conversation members
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages viewable by conversation members" 
  ON messages FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = messages.conversation_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Messages creatable by conversation members" 
  ON messages FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = messages.conversation_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Messages updatable by author" 
  ON messages FOR UPDATE 
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = messages.conversation_id 
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'moderator')
    )
  );

CREATE POLICY "Messages deletable by author or moderators" 
  ON messages FOR DELETE 
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = messages.conversation_id 
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'moderator')
    )
  );

-- Message Reactions: Users can manage their own reactions
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions viewable by everyone" 
  ON message_reactions FOR SELECT USING (true);

CREATE POLICY "Reactions creatable by authenticated" 
  ON message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Reactions deletable by owner" 
  ON message_reactions FOR DELETE USING (auth.uid() = user_id);

-- Message Reads: Users can view and update their own reads
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Message reads viewable by conversation members" 
  ON message_reads FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.id = message_reads.message_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can mark messages as read" 
  ON message_reads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Typing Status: Users can view and update
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Typing status viewable by conversation members" 
  ON typing_status FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = typing_status.conversation_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own typing status" 
  ON typing_status FOR ALL USING (auth.uid() = user_id);

-- User Presence: Viewable by all, updatable by self
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Presence viewable by everyone" 
  ON user_presence FOR SELECT USING (true);

CREATE POLICY "Users can update own presence" 
  ON user_presence FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- VISTAS ÚTILES
-- ============================================================================

-- Vista de conversaciones con info del último mensaje
CREATE OR REPLACE VIEW conversation_list AS
SELECT 
  c.*,
  cm.unread_count,
  cm.last_read_at,
  cm.role as user_role,
  cm.is_muted,
  cm.is_pinned,
  cm.joined_at as user_joined_at
FROM conversations c
JOIN conversation_members cm ON cm.conversation_id = c.id
WHERE cm.user_id = auth.uid()
  AND c.is_archived = FALSE
ORDER BY c.last_message_at DESC NULLS LAST;

-- Vista de mensajes con info del autor
CREATE OR REPLACE VIEW message_details AS
SELECT 
  m.*,
  p.username as author_username,
  p.display_name as author_display_name,
  p.avatar_url as author_avatar_url,
  p.status as author_status,
  array_agg(DISTINCT mr.emoji) as reactions,
  jsonb_object_agg(
    mr.emoji,
    jsonb_build_object(
      'count', COUNT(DISTINCT mr.user_id),
      'users', jsonb_agg(DISTINCT mr.user_id),
      'me', bool_or(mr.user_id = auth.uid())
    )
  ) FILTER (WHERE mr.emoji IS NOT NULL) as reaction_details
FROM messages m
LEFT JOIN profiles p ON p.id = m.user_id
LEFT JOIN message_reactions mr ON mr.message_id = m.id
WHERE m.is_deleted = FALSE
GROUP BY m.id, p.username, p.display_name, p.avatar_url, p.status;

-- ============================================================================
-- CONFIGURACIÓN REALTIME
-- ============================================================================

-- Habilitar realtime en todas las tablas relevantes
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE typing_status;
ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;

-- Configurar filters para realtime (opcional, aplicar según necesidad)
-- Esto permite suscribirse a cambios específicos

-- ============================================================================
-- DATOS INICIALES
-- ============================================================================

-- Crear conversación general automáticamente
INSERT INTO conversations (type, slug, name, description, created_by, is_private)
SELECT 'channel', 'general', 'General', 'Canal general para todos los usuarios', id, FALSE
FROM auth.users
WHERE email LIKE '%admin%' OR raw_user_meta_data->>'role' = 'admin'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Agregar todos los usuarios existentes al canal general
INSERT INTO conversation_members (conversation_id, user_id, role)
SELECT c.id, p.id, CASE WHEN p.id = c.created_by THEN 'owner' ELSE 'member' END
FROM conversations c
CROSS JOIN profiles p
WHERE c.slug = 'general'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PERMISOS ADICIONALES
-- ============================================================================

-- Asegurar que el service_role pueda hacer todo
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Permitir a usuarios autenticados ejecutar funciones
GRANT EXECUTE ON FUNCTION cleanup_expired_typing() TO authenticated;
