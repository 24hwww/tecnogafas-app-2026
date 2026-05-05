-- ============================================================================
-- SISTEMA DE CHAT REALTIME CON SUPABASE
-- Arquitectura: Discord + Slack + Telegram hybrid
-- VERSION CORREGIDA
-- ============================================================================

-- ============================================================================
-- EXTENSIONES
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- FUNCTION: updated_at helper
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,

  status TEXT DEFAULT 'offline'
    CHECK (status IN ('online', 'away', 'dnd', 'offline')),

  status_message TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username
  ON profiles(username);

CREATE INDEX IF NOT EXISTS idx_profiles_status
  ON profiles(status);

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON profiles(last_seen_at);

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. CONVERSATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  type TEXT NOT NULL
    CHECK (type IN ('channel', 'group', 'direct')),

  slug TEXT UNIQUE,

  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,

  created_by UUID NOT NULL
    REFERENCES profiles(id) ON DELETE CASCADE,

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

CREATE INDEX IF NOT EXISTS idx_conversations_type
  ON conversations(type);

CREATE INDEX IF NOT EXISTS idx_conversations_slug
  ON conversations(slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_last_message
  ON conversations(last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_conversations_archived
  ON conversations(is_archived)
  WHERE is_archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_conversations_metadata
  ON conversations USING GIN(metadata);

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. CONVERSATION MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  conversation_id UUID NOT NULL
    REFERENCES conversations(id) ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES profiles(id) ON DELETE CASCADE,

  role TEXT DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'moderator', 'member')),

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

CREATE INDEX IF NOT EXISTS idx_conversation_members_user
  ON conversation_members(user_id, joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_members_conv
  ON conversation_members(conversation_id, joined_at);

CREATE INDEX IF NOT EXISTS idx_conversation_members_unread
  ON conversation_members(user_id, unread_count)
  WHERE unread_count > 0;

CREATE INDEX IF NOT EXISTS idx_conversation_members_last_read
  ON conversation_members(user_id, last_read_at);

DROP TRIGGER IF EXISTS update_conversation_members_updated_at
  ON conversation_members;

CREATE TRIGGER update_conversation_members_updated_at
  BEFORE UPDATE ON conversation_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  conversation_id UUID NOT NULL
    REFERENCES conversations(id) ON DELETE CASCADE,

  parent_id UUID
    REFERENCES messages(id) ON DELETE CASCADE,

  user_id UUID
    REFERENCES profiles(id) ON DELETE SET NULL,

  type TEXT DEFAULT 'text'
    CHECK (
      type IN (
        'text',
        'system',
        'order',
        'alert',
        'media',
        'file',
        'voice',
        'poll'
      )
    ),

  content TEXT NOT NULL,
  content_html TEXT,

  metadata JSONB DEFAULT '{}',

  order_data JSONB,
  alert_data JSONB,

  attachments JSONB DEFAULT '[]',

  reply_count INTEGER DEFAULT 0,
  reaction_count INTEGER DEFAULT 0,

  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,

  edited_at TIMESTAMPTZ,

  deleted_at TIMESTAMPTZ,

  deleted_by UUID
    REFERENCES profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_type
  ON messages(conversation_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_parent
  ON messages(parent_id, created_at)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_user
  ON messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_type_system
  ON messages(type, created_at)
  WHERE type = 'system';

CREATE INDEX IF NOT EXISTS idx_messages_metadata
  ON messages USING GIN(metadata);

CREATE INDEX IF NOT EXISTS idx_messages_order_data
  ON messages USING GIN(order_data)
  WHERE order_data IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_search
  ON messages USING GIN(to_tsvector('spanish', content));

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. MESSAGE REACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  message_id UUID NOT NULL
    REFERENCES messages(id) ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES profiles(id) ON DELETE CASCADE,

  emoji TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON message_reactions(message_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_user
  ON message_reactions(user_id);

-- ============================================================================
-- 6. MESSAGE READS
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  message_id UUID NOT NULL
    REFERENCES messages(id) ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES profiles(id) ON DELETE CASCADE,

  read_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reads_message
  ON message_reads(message_id);

CREATE INDEX IF NOT EXISTS idx_message_reads_user
  ON message_reads(user_id);

-- ============================================================================
-- 7. TYPING STATUS
-- ============================================================================

CREATE TABLE IF NOT EXISTS typing_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  conversation_id UUID NOT NULL
    REFERENCES conversations(id) ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES profiles(id) ON DELETE CASCADE,

  started_at TIMESTAMPTZ DEFAULT NOW(),

  expires_at TIMESTAMPTZ DEFAULT (
    NOW() + INTERVAL '30 seconds'
  ),

  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_typing_status_conversation
  ON typing_status(conversation_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_typing_status_expires
  ON typing_status(expires_at);

-- ============================================================================
-- 8. USER PRESENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY
    REFERENCES profiles(id) ON DELETE CASCADE,

  status TEXT DEFAULT 'offline'
    CHECK (status IN ('online', 'away', 'dnd', 'offline')),

  last_active_at TIMESTAMPTZ DEFAULT NOW(),

  device_info JSONB DEFAULT '{}',

  ip_address INET,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_status
  ON user_presence(status, last_active_at);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_typing()
RETURNS void AS $$
BEGIN
  DELETE FROM typing_status
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MESSAGE COUNT
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_message_count
  ON messages;

CREATE TRIGGER trigger_increment_message_count
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_conversation_message_count();

-- ============================================================================
-- UNREAD COUNTS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_unread_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversation_members
  SET
    unread_count = unread_count + 1,
    updated_at = NOW()
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.user_id
    AND last_read_at < NEW.created_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_unread_counts
  ON messages;

CREATE TRIGGER trigger_update_unread_counts
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_unread_counts();

-- ============================================================================
-- REPLY COUNT
-- ============================================================================

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

DROP TRIGGER IF EXISTS trigger_update_reply_count
  ON messages;

CREATE TRIGGER trigger_update_reply_count
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_parent_reply_count();

-- ============================================================================
-- REACTION COUNT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_message_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN

    UPDATE messages
    SET reaction_count = reaction_count + 1
    WHERE id = NEW.message_id;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN

    UPDATE messages
    SET reaction_count = reaction_count - 1
    WHERE id = OLD.message_id;

    RETURN OLD;

  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reaction_count_insert
  ON message_reactions;

DROP TRIGGER IF EXISTS trigger_update_reaction_count_delete
  ON message_reactions;

CREATE TRIGGER trigger_update_reaction_count_insert
  AFTER INSERT ON message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_message_reaction_count();

CREATE TRIGGER trigger_update_reaction_count_delete
  AFTER DELETE ON message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_message_reaction_count();

-- ============================================================================
-- AUTO PROFILE CREATION
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN

  INSERT INTO profiles (
    id,
    username,
    display_name,
    created_at
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      'user_' || substr(NEW.id::text, 1, 8)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.email
    ),
    NOW()
  );

  INSERT INTO user_presence (
    user_id,
    status,
    last_active_at
  )
  VALUES (
    NEW.id,
    'offline',
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created
  ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Profiles are viewable by everyone"
  ON profiles;

CREATE POLICY "Profiles are viewable by everyone"
ON profiles
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can update own profile"
  ON profiles;

CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id);

-- ============================================================================
-- CONVERSATIONS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Conversations viewable by members"
  ON conversations;

CREATE POLICY "Conversations viewable by members"
ON conversations
FOR SELECT
USING (
  NOT is_private
  OR EXISTS (
    SELECT 1
    FROM conversation_members
    WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Conversations creatable by authenticated"
  ON conversations;

CREATE POLICY "Conversations creatable by authenticated"
ON conversations
FOR INSERT
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Conversations updatable by owners/admins"
  ON conversations;

CREATE POLICY "Conversations updatable by owners/admins"
ON conversations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM conversation_members
    WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- MEMBERS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Conversation members viewable by members"
  ON conversation_members;

CREATE POLICY "Conversation members viewable by members"
ON conversation_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM conversation_members cm2
    WHERE cm2.conversation_id = conversation_members.conversation_id
      AND cm2.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can join public conversations"
  ON conversation_members;

CREATE POLICY "Users can join public conversations"
ON conversation_members
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM conversations
    WHERE id = conversation_id
      AND NOT is_private
  )
);

DROP POLICY IF EXISTS "Users can update own membership"
  ON conversation_members;

CREATE POLICY "Users can update own membership"
ON conversation_members
FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can leave conversations"
  ON conversation_members;

CREATE POLICY "Users can leave conversations"
ON conversation_members
FOR DELETE
USING (user_id = auth.uid());

-- ============================================================================
-- MESSAGE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Messages viewable by conversation members"
  ON messages;

CREATE POLICY "Messages viewable by conversation members"
ON messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM conversation_members
    WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Messages creatable by conversation members"
  ON messages;

CREATE POLICY "Messages creatable by conversation members"
ON messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM conversation_members
    WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Messages updatable by author"
  ON messages;

CREATE POLICY "Messages updatable by author"
ON messages
FOR UPDATE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM conversation_members
    WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'moderator')
  )
);

DROP POLICY IF EXISTS "Messages deletable by author or moderators"
  ON messages;

CREATE POLICY "Messages deletable by author or moderators"
ON messages
FOR DELETE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM conversation_members
    WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'moderator')
  )
);

-- ============================================================================
-- REACTION POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Reactions viewable by everyone"
  ON message_reactions;

CREATE POLICY "Reactions viewable by everyone"
ON message_reactions
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Reactions creatable by authenticated"
  ON message_reactions;

CREATE POLICY "Reactions creatable by authenticated"
ON message_reactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Reactions deletable by owner"
  ON message_reactions;

CREATE POLICY "Reactions deletable by owner"
ON message_reactions
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- READ POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Message reads viewable by conversation members"
  ON message_reads;

CREATE POLICY "Message reads viewable by conversation members"
ON message_reads
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM messages m
    JOIN conversation_members cm
      ON cm.conversation_id = m.conversation_id
    WHERE m.id = message_reads.message_id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can mark messages as read"
  ON message_reads;

CREATE POLICY "Users can mark messages as read"
ON message_reads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TYPING POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Typing status viewable by conversation members"
  ON typing_status;

CREATE POLICY "Typing status viewable by conversation members"
ON typing_status
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM conversation_members
    WHERE conversation_id = typing_status.conversation_id
      AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own typing status"
  ON typing_status;

CREATE POLICY "Users can update own typing status"
ON typing_status
FOR ALL
USING (auth.uid() = user_id);

-- ============================================================================
-- PRESENCE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Presence viewable by everyone"
  ON user_presence;

CREATE POLICY "Presence viewable by everyone"
ON user_presence
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can update own presence"
  ON user_presence;

CREATE POLICY "Users can update own presence"
ON user_presence
FOR ALL
USING (auth.uid() = user_id);

-- ============================================================================
-- VIEWS
-- ============================================================================

DROP VIEW IF EXISTS conversation_list;

CREATE OR REPLACE VIEW conversation_list AS
SELECT
  c.*,

  cm.unread_count,
  cm.last_read_at,
  cm.role AS user_role,

  cm.is_muted,
  cm.is_pinned,

  cm.joined_at AS user_joined_at

FROM conversations c

JOIN conversation_members cm
  ON cm.conversation_id = c.id

WHERE cm.user_id = auth.uid()
  AND c.is_archived = FALSE

ORDER BY c.last_message_at DESC NULLS LAST;

-- ============================================================================
-- MESSAGE DETAILS VIEW (CORREGIDA)
-- ============================================================================

DROP VIEW IF EXISTS message_details;

CREATE OR REPLACE VIEW message_details AS

WITH reaction_stats AS (
  SELECT
    mr.message_id,
    mr.emoji,

    COUNT(DISTINCT mr.user_id) AS reaction_count,

    jsonb_agg(DISTINCT mr.user_id) AS users,

    bool_or(mr.user_id = auth.uid()) AS me

  FROM message_reactions mr

  GROUP BY
    mr.message_id,
    mr.emoji
)

SELECT
  m.*,

  p.username AS author_username,
  p.display_name AS author_display_name,
  p.avatar_url AS author_avatar_url,
  p.status AS author_status,

  array_agg(DISTINCT rs.emoji)
    FILTER (WHERE rs.emoji IS NOT NULL) AS reactions,

  jsonb_object_agg(
    rs.emoji,
    jsonb_build_object(
      'count', rs.reaction_count,
      'users', rs.users,
      'me', rs.me
    )
  ) FILTER (WHERE rs.emoji IS NOT NULL) AS reaction_details

FROM messages m

LEFT JOIN profiles p
  ON p.id = m.user_id

LEFT JOIN reaction_stats rs
  ON rs.message_id = m.id

WHERE m.is_deleted = FALSE

GROUP BY
  m.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.status;

-- ============================================================================
-- REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime
  ADD TABLE conversations;

ALTER PUBLICATION supabase_realtime
  ADD TABLE conversation_members;

ALTER PUBLICATION supabase_realtime
  ADD TABLE messages;

ALTER PUBLICATION supabase_realtime
  ADD TABLE message_reactions;

ALTER PUBLICATION supabase_realtime
  ADD TABLE message_reads;

ALTER PUBLICATION supabase_realtime
  ADD TABLE typing_status;

ALTER PUBLICATION supabase_realtime
  ADD TABLE user_presence;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

INSERT INTO conversations (
  type,
  slug,
  name,
  description,
  created_by,
  is_private
)
SELECT
  'channel',
  'general',
  'General',
  'Canal general para todos los usuarios',
  id,
  FALSE
FROM auth.users
WHERE email LIKE '%admin%'
   OR raw_user_meta_data->>'role' = 'admin'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO conversation_members (
  conversation_id,
  user_id,
  role
)
SELECT
  c.id,
  p.id,

  CASE
    WHEN p.id = c.created_by THEN 'owner'
    ELSE 'member'
  END

FROM conversations c
CROSS JOIN profiles p

WHERE c.slug = 'general'

ON CONFLICT DO NOTHING;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT EXECUTE ON FUNCTION cleanup_expired_typing()
TO authenticated;