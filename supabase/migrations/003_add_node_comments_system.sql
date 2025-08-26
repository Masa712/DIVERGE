-- Node Comments System for Multi-User Collaboration
-- This migration adds comment functionality to chat nodes with multi-user support

-- Create comment types
CREATE TYPE comment_type AS ENUM ('user_comment', 'system_note', 'evaluation_feedback');

-- Node Comments Table
CREATE TABLE node_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id UUID NOT NULL REFERENCES chat_nodes(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Comment content and metadata
  content TEXT NOT NULL,
  comment_type comment_type DEFAULT 'user_comment',
  parent_comment_id UUID REFERENCES node_comments(id) ON DELETE CASCADE, -- For threaded comments
  
  -- Version and editing support
  version INTEGER DEFAULT 1,
  is_edited BOOLEAN DEFAULT FALSE,
  edit_history JSONB DEFAULT '[]',
  
  -- Multi-user collaboration features
  mentions JSONB DEFAULT '[]', -- Array of mentioned user IDs
  reactions JSONB DEFAULT '{}', -- Emoji reactions by users
  is_pinned BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE, -- For feedback/discussion comments
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Participants Table (for future multi-user session support)
CREATE TABLE session_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Permission and role management
  role TEXT DEFAULT 'viewer', -- 'owner', 'editor', 'viewer', 'commenter'
  permissions JSONB DEFAULT '{"can_comment": true, "can_edit_nodes": false, "can_invite": false}',
  
  -- Participation metadata
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  invitation_status TEXT DEFAULT 'accepted', -- 'invited', 'accepted', 'declined'
  invited_by UUID REFERENCES auth.users(id),
  
  -- Unique constraint to prevent duplicate participants
  UNIQUE(session_id, user_id)
);

-- User Profiles Table (for display names, avatars, etc.)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment Reactions Table (for detailed reaction tracking)
CREATE TABLE comment_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES node_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL, -- emoji or reaction type
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate reactions from same user on same comment
  UNIQUE(comment_id, user_id, reaction)
);

-- Create indexes for performance
CREATE INDEX idx_node_comments_node_id ON node_comments(node_id, created_at DESC);
CREATE INDEX idx_node_comments_session_id ON node_comments(session_id, created_at DESC);
CREATE INDEX idx_node_comments_user_id ON node_comments(user_id, created_at DESC);
CREATE INDEX idx_node_comments_parent ON node_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_node_comments_type ON node_comments(comment_type);
CREATE INDEX idx_node_comments_pinned ON node_comments(is_pinned) WHERE is_pinned = true;

CREATE INDEX idx_session_participants_session ON session_participants(session_id, is_active);
CREATE INDEX idx_session_participants_user ON session_participants(user_id, is_active);
CREATE INDEX idx_session_participants_role ON session_participants(session_id, role);

CREATE INDEX idx_user_profiles_display_name ON user_profiles(display_name);

CREATE INDEX idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX idx_comment_reactions_user ON comment_reactions(user_id);

-- Row Level Security (RLS)
ALTER TABLE node_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for node_comments
CREATE POLICY "Users can view comments in sessions they participate in" ON node_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM session_participants sp
      WHERE sp.session_id = node_comments.session_id
      AND sp.user_id = auth.uid()
      AND sp.is_active = true
    )
    OR
    -- Original session owner can always view
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = node_comments.session_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create comments in sessions they can comment in" ON node_comments
  FOR INSERT WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM session_participants sp
        WHERE sp.session_id = node_comments.session_id
        AND sp.user_id = auth.uid()
        AND sp.is_active = true
        AND (sp.permissions->>'can_comment')::boolean = true
      )
      OR
      -- Original session owner can always comment
      EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.id = node_comments.session_id
        AND s.user_id = auth.uid()
      )
    )
    AND auth.uid() = user_id -- Users can only create comments as themselves
  );

CREATE POLICY "Users can update their own comments" ON node_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON node_comments
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for session_participants
CREATE POLICY "Users can view participants in their sessions" ON session_participants
  FOR SELECT USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_participants.session_id
      AND s.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM session_participants sp2
      WHERE sp2.session_id = session_participants.session_id
      AND sp2.user_id = auth.uid()
      AND sp2.is_active = true
    )
  );

-- RLS Policies for user_profiles
CREATE POLICY "Users can view all profiles" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for comment_reactions
CREATE POLICY "Users can view reactions in accessible sessions" ON comment_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM node_comments nc
      JOIN session_participants sp ON sp.session_id = nc.session_id
      WHERE nc.id = comment_reactions.comment_id
      AND sp.user_id = auth.uid()
      AND sp.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM node_comments nc
      JOIN sessions s ON s.id = nc.session_id
      WHERE nc.id = comment_reactions.comment_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own reactions" ON comment_reactions
  FOR ALL USING (auth.uid() = user_id);

-- Functions for maintaining comment counts and session statistics
CREATE OR REPLACE FUNCTION update_session_comment_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update session stats when comments are added/removed
  IF TG_OP = 'INSERT' THEN
    -- Update session metadata to include comment activity
    UPDATE sessions 
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'last_comment_at', NEW.created_at,
      'comment_count', COALESCE((metadata->>'comment_count')::integer, 0) + 1
    )
    WHERE id = NEW.session_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrease comment count
    UPDATE sessions 
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'comment_count', GREATEST(COALESCE((metadata->>'comment_count')::integer, 1) - 1, 0)
    )
    WHERE id = OLD.session_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically add session owner as participant
CREATE OR REPLACE FUNCTION add_session_owner_as_participant()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new session is created, add the owner as a participant with full permissions
  INSERT INTO session_participants (session_id, user_id, role, permissions)
  VALUES (
    NEW.id,
    NEW.user_id,
    'owner',
    '{"can_comment": true, "can_edit_nodes": true, "can_invite": true, "can_delete": true}'::jsonb
  )
  ON CONFLICT (session_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_node_comments_updated_at
  BEFORE UPDATE ON node_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_session_participants_updated_at
  BEFORE UPDATE ON session_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER session_comment_stats_trigger
  AFTER INSERT OR DELETE ON node_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_session_comment_stats();

CREATE TRIGGER session_owner_participant_trigger
  AFTER INSERT ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION add_session_owner_as_participant();

-- Helpful views for common queries
CREATE VIEW session_comment_summary AS
SELECT 
  s.id as session_id,
  s.name as session_name,
  COUNT(nc.id) as total_comments,
  COUNT(DISTINCT nc.user_id) as unique_commenters,
  MAX(nc.created_at) as last_comment_at,
  COUNT(CASE WHEN nc.is_pinned THEN 1 END) as pinned_comments
FROM sessions s
LEFT JOIN node_comments nc ON nc.session_id = s.id
GROUP BY s.id, s.name;

CREATE VIEW user_comment_activity AS
SELECT 
  up.id as user_id,
  up.display_name,
  COUNT(nc.id) as total_comments,
  COUNT(DISTINCT nc.session_id) as sessions_commented,
  MAX(nc.created_at) as last_comment_at
FROM user_profiles up
LEFT JOIN node_comments nc ON nc.user_id = up.id
GROUP BY up.id, up.display_name;