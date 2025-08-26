-- Restore tables that were dropped by 006 but are still needed for future functionality
-- Fixed version that checks for existing policies

-- 1. Session Participants Table (for multi-user collaboration)
CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'viewer',
  permissions JSONB DEFAULT '{"can_comment": true, "can_edit_nodes": false, "can_invite": false}',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  invitation_status TEXT DEFAULT 'accepted',
  invited_by UUID REFERENCES auth.users(id),
  UNIQUE(session_id, user_id)
);

-- 2. User Profiles Table (for display names and avatars)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Comment Reactions Table (for future emoji reactions)
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES node_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id, reaction)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_session_participants_session ON session_participants(session_id, is_active);
CREATE INDEX IF NOT EXISTS idx_session_participants_user ON session_participants(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON user_profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id);

-- Enable RLS
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating them
DROP POLICY IF EXISTS "Users can view participants in their sessions" ON session_participants;
DROP POLICY IF EXISTS "Anyone can view profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view reactions" ON comment_reactions;
DROP POLICY IF EXISTS "Users can manage own reactions" ON comment_reactions;

-- RLS Policies for session_participants (simplified to avoid recursion)
CREATE POLICY "Users can view participants in their sessions" ON session_participants
  FOR SELECT USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_participants.session_id
      AND s.user_id = auth.uid()
    )
  );

-- RLS Policies for user_profiles
CREATE POLICY "Anyone can view profiles" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for comment_reactions
CREATE POLICY "Users can view reactions" ON comment_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM node_comments nc
      JOIN sessions s ON s.id = nc.session_id
      WHERE nc.id = comment_reactions.comment_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own reactions" ON comment_reactions
  FOR ALL USING (auth.uid() = user_id);

-- Add existing session owners as participants
INSERT INTO session_participants (session_id, user_id, role, permissions)
SELECT 
  id as session_id,
  user_id,
  'owner' as role,
  '{"can_comment": true, "can_edit_nodes": true, "can_invite": true, "can_delete": true}'::jsonb as permissions
FROM sessions
ON CONFLICT (session_id, user_id) DO NOTHING;

-- Create user profiles for existing users
INSERT INTO user_profiles (id, display_name)
SELECT DISTINCT 
  user_id as id,
  'User' as display_name  -- Default display name
FROM sessions
ON CONFLICT (id) DO NOTHING;

-- Check if trigger function exists before creating
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

-- Add trigger for updated_at on user_profiles
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Drop existing function and trigger before recreating
DROP TRIGGER IF EXISTS session_owner_participant_trigger ON sessions;
DROP FUNCTION IF EXISTS add_session_owner_as_participant();

-- Function to automatically add session owner as participant (safe version)
CREATE OR REPLACE FUNCTION add_session_owner_as_participant()
RETURNS TRIGGER AS $$
BEGIN
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

-- Trigger for new sessions
CREATE TRIGGER session_owner_participant_trigger
  AFTER INSERT ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION add_session_owner_as_participant();