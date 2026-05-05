-- ============================================================================
-- SUPABASE REALTIME CHAT SYSTEM
-- Discord + Slack + Telegram hybrid
-- FULLY CORRECTED / SAFE VERSION
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,

  status TEXT DEFAULT 'offline'
    CHECK (
      status IN (
        'online',
        'away',
        'dnd',
        'offline'
      )
    ),

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

DROP TRIGGER IF EXISTS update_profiles_updated_at
  ON profiles;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CONVERSATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  type TEXT NOT NULL
    CHECK (
      type IN (
        'channel',
        'group',
        'direct'
      )
    ),

  slug TEXT UNIQUE,

  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,

  created_by UUID NOT NULL
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  is_private BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,

  metadata JSONB DEFAULT '{}',

  settings JSONB DEFAULT '{
    "slow_mode": 0,
    "allow_reactions": true,
    "allow_threads": true,
    "allow_editing": true,
    "allow_deleting": true
  }',

  message_count INTEGER DEFAULT 0,
  member_count INTEGER DEFAULT 0,

  last_message_at TIMESTAMPTZ,

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

DROP TRIGGER IF EXISTS update_conversations_updated_at
  ON conversations;

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CONVERSATION MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  conversation_id UUID NOT NULL
    REFERENCES conversations(id)
    ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  role TEXT DEFAULT 'member'
    CHECK (
      role IN (
        'owner',
        'admin',
        'moderator',
        'member'
      )
    ),

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
  ON conversation_members(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation
  ON conversation_members(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_members_unread
  ON conversation_members(user_id, unread_count)
  WHERE unread_count > 0;

DROP TRIGGER IF EXISTS update_conversation_members_updated_at
  ON conversation_members;

CREATE TRIGGER update_conversation_members_updated_at
  BEFORE UPDATE ON conversation_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  conversation_id UUID NOT NULL
    REFERENCES conversations(id)
    ON DELETE CASCADE,

  parent_id UUID
    REFERENCES messages(id)
    ON DELETE CASCADE,

  user_id UUID
    REFERENCES profiles(id)
    ON DELETE SET NULL,

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

  attachments JSONB DEFAULT '[]',

  order_data JSONB,
  alert_data JSONB,

  reply_count INTEGER DEFAULT 0,
  reaction_count INTEGER DEFAULT 0,

  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,

  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  deleted_by UUID
    REFERENCES profiles(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_parent
  ON messages(parent_id)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_user
  ON messages(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_search
  ON messages
  USING GIN(to_tsvector('spanish', content));

CREATE INDEX IF NOT EXISTS idx_messages_metadata
  ON messages USING GIN(metadata);

DROP TRIGGER IF EXISTS update_messages_updated_at
  ON messages;

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MESSAGE REACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  message_id UUID NOT NULL
    REFERENCES messages(id)
    ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  emoji TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON message_reactions(message_id);

-- ============================================================================
-- MESSAGE READS
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  message_id UUID NOT NULL
    REFERENCES messages(id)
    ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  read_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(message_id, user_id)
);

-- ============================================================================
-- TYPING STATUS
-- ============================================================================

CREATE TABLE IF NOT EXISTS typing_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  conversation_id UUID NOT NULL
    REFERENCES conversations(id)
    ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  started_at TIMESTAMPTZ DEFAULT NOW(),

  expires_at TIMESTAMPTZ DEFAULT (
    NOW() + INTERVAL '30 seconds'
  ),

  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_typing_status_expires
  ON typing_status(expires_at);

-- ============================================================================
-- USER PRESENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  status TEXT DEFAULT 'offline'
    CHECK (
      status IN (
        'online',
        'away',
        'dnd',
        'offline'
      )
    ),

  last_active_at TIMESTAMPTZ DEFAULT NOW(),

  device_info JSONB DEFAULT '{}',

  ip_address INET,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_typing()
RETURNS VOID AS $$
BEGIN
  DELETE FROM typing_status
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MESSAGE COUNTERS
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
    AND user_id != NEW.user_id;

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
-- REPLY COUNTS
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
-- REACTION COUNTS
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
    display_name
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
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_presence (
    user_id
  )
  VALUES (
    NEW.id
  )
  ON CONFLICT (user_id) DO NOTHING;

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

DROP POLICY IF EXISTS "profiles_select"
  ON profiles;

CREATE POLICY "profiles_select"
ON profiles
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "profiles_update_own"
  ON profiles;

CREATE POLICY "profiles_update_own"
ON profiles
FOR UPDATE
USING (auth.uid() = id);

-- ============================================================================
-- CONVERSATIONS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "conversations_select"
  ON conversations;

CREATE POLICY "conversations_select"
ON conversations
FOR SELECT
USING (
  NOT is_private
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "conversations_insert"
  ON conversations;

CREATE POLICY "conversations_insert"
ON conversations
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
);

DROP POLICY IF EXISTS "conversations_update"
  ON conversations;

CREATE POLICY "conversations_update"
ON conversations
FOR UPDATE
USING (
  created_by = auth.uid()
);

-- ============================================================================
-- CONVERSATION MEMBERS POLICIES
-- SAFE VERSION (NO RECURSION)
-- ============================================================================

DROP POLICY IF EXISTS "conversation_members_select"
  ON conversation_members;

CREATE POLICY "conversation_members_select"
ON conversation_members
FOR SELECT
USING (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "conversation_members_insert"
  ON conversation_members;

CREATE POLICY "conversation_members_insert"
ON conversation_members
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "conversation_members_update"
  ON conversation_members;

CREATE POLICY "conversation_members_update"
ON conversation_members
FOR UPDATE
USING (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "conversation_members_delete"
  ON conversation_members;

CREATE POLICY "conversation_members_delete"
ON conversation_members
FOR DELETE
USING (
  auth.uid() = user_id
);

-- ============================================================================
-- MESSAGES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "messages_select"
  ON messages;

CREATE POLICY "messages_select"
ON messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM conversation_members cm
    WHERE cm.conversation_id = messages.conversation_id
      AND cm.user_id = auth.uid()
  )
);

-- POLÍTICA DE PRODUCCIÓN: Solo miembros pueden insertar
DROP POLICY IF EXISTS "messages_insert"
  ON messages;

CREATE POLICY "messages_insert"
ON messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM conversation_members cm
    WHERE cm.conversation_id = messages.conversation_id
      AND cm.user_id = auth.uid()
  )
);

-- POLÍTICA DE TEST/DEV: Cualquier usuario autenticado puede insertar
DROP POLICY IF EXISTS "messages_insert_test"
  ON messages;

CREATE POLICY "messages_insert_test"
ON messages
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "messages_update"
  ON messages;

CREATE POLICY "messages_update"
ON messages
FOR UPDATE
USING (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "messages_delete"
  ON messages;

CREATE POLICY "messages_delete"
ON messages
FOR DELETE
USING (
  user_id = auth.uid()
);

-- ============================================================================
-- MESSAGE REACTIONS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "message_reactions_select"
  ON message_reactions;

CREATE POLICY "message_reactions_select"
ON message_reactions
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "message_reactions_insert"
  ON message_reactions;

CREATE POLICY "message_reactions_insert"
ON message_reactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "message_reactions_delete"
  ON message_reactions;

CREATE POLICY "message_reactions_delete"
ON message_reactions
FOR DELETE
USING (
  auth.uid() = user_id
);

-- ============================================================================
-- MESSAGE READS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "message_reads_select"
  ON message_reads;

CREATE POLICY "message_reads_select"
ON message_reads
FOR SELECT
USING (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "message_reads_insert"
  ON message_reads;

CREATE POLICY "message_reads_insert"
ON message_reads
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

-- ============================================================================
-- TYPING STATUS POLICIES
-- SAFE VERSION
-- ============================================================================

DROP POLICY IF EXISTS "typing_status_select"
  ON typing_status;

CREATE POLICY "typing_status_select"
ON typing_status
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "typing_status_all"
  ON typing_status;

CREATE POLICY "typing_status_all"
ON typing_status
FOR ALL
USING (
  auth.uid() = user_id
);

-- ============================================================================
-- USER PRESENCE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "user_presence_select"
  ON user_presence;

CREATE POLICY "user_presence_select"
ON user_presence
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "user_presence_update"
  ON user_presence;

CREATE POLICY "user_presence_update"
ON user_presence
FOR ALL
USING (
  auth.uid() = user_id
);

-- ============================================================================
-- VIEWS
-- ============================================================================

DROP VIEW IF EXISTS conversation_list;

CREATE VIEW conversation_list AS
SELECT
  c.*,
  cm.role,
  cm.unread_count,
  cm.last_read_at,
  cm.is_muted,
  cm.is_pinned
FROM conversations c
JOIN conversation_members cm
  ON cm.conversation_id = c.id
WHERE cm.user_id = auth.uid();

-- ============================================================================
-- MESSAGE DETAILS VIEW
-- FIXED AGGREGATION
-- ============================================================================

DROP VIEW IF EXISTS message_details;

CREATE VIEW message_details AS

WITH reaction_stats AS (
  SELECT
    mr.message_id,
    mr.emoji,

    COUNT(DISTINCT mr.user_id) AS reaction_count,

    jsonb_agg(DISTINCT mr.user_id) AS users

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

  array_agg(DISTINCT rs.emoji)
    FILTER (WHERE rs.emoji IS NOT NULL)
    AS reactions,

  jsonb_object_agg(
    rs.emoji,
    jsonb_build_object(
      'count', rs.reaction_count,
      'users', rs.users
    )
  )
  FILTER (WHERE rs.emoji IS NOT NULL)
  AS reaction_details

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
  p.avatar_url;

-- ============================================================================
-- REALTIME
-- SAFE / IDEMPOTENT
-- ============================================================================

DO $$
BEGIN

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'conversation_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE conversation_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE message_reactions;
  END IF;

END $$;

-- ============================================================================
-- INITIAL GENERAL CHANNEL
-- ============================================================================

DO $$
DECLARE
  first_user UUID;
BEGIN

  SELECT id
  INTO first_user
  FROM profiles
  LIMIT 1;

  IF first_user IS NOT NULL THEN

    INSERT INTO conversations (
      type,
      slug,
      name,
      description,
      created_by,
      is_private
    )
    VALUES (
      'channel',
      'general',
      'General',
      'General channel',
      first_user,
      FALSE
    )
    ON CONFLICT (slug) DO NOTHING;

  END IF;

END $$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA public
TO service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public
TO service_role;

GRANT ALL ON ALL FUNCTIONS IN SCHEMA public
TO service_role;

GRANT EXECUTE ON FUNCTION cleanup_expired_typing()
TO authenticated;