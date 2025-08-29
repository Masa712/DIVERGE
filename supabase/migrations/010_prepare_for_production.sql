-- Migration: Prepare for Production Features
-- Date: 2025-01-29
-- Purpose: Add necessary schema changes for upcoming features

-- ============================================
-- 1. ENHANCED USER PROFILES
-- ============================================

-- Add additional profile fields
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS 
  bio TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS github_username TEXT,
  ADD COLUMN IF NOT EXISTS twitter_username TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Add profile settings JSONB for flexible preferences
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS 
  settings JSONB DEFAULT '{
    "theme": "light",
    "ai_preferences": {
      "default_model": "openai/gpt-4o",
      "temperature": 0.7,
      "max_tokens": 2000
    },
    "collaboration": {
      "allow_invites": true,
      "default_visibility": "private"
    }
  }'::jsonb;

-- ============================================
-- 2. SESSION SHARING & COLLABORATION
-- ============================================

-- Add visibility and sharing settings to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS 
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public')),
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT uuid_generate_v4(),
  ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_branches BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Session invitations table
CREATE TABLE IF NOT EXISTS session_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id),
  invitee_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'moderator')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  invited_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP + INTERVAL '7 days',
  UNIQUE(session_id, invitee_email)
);

-- Real-time collaboration events
CREATE TABLE IF NOT EXISTS collaboration_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('join', 'leave', 'typing', 'node_select', 'node_edit')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. AI TOOL USAGE & INTERNET ACCESS
-- ============================================

-- Track AI tool/function calls
CREATE TABLE IF NOT EXISTS ai_tool_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id UUID NOT NULL REFERENCES chat_nodes(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  tool_type TEXT CHECK (tool_type IN ('search', 'browse', 'calculator', 'code_interpreter', 'image_generation', 'custom')),
  input_params JSONB,
  output_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

-- Store web search results for caching
CREATE TABLE IF NOT EXISTS web_search_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_hash TEXT UNIQUE NOT NULL,
  query TEXT NOT NULL,
  search_engine TEXT DEFAULT 'perplexity',
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours'
);

-- ============================================
-- 4. OAUTH PROVIDER CONNECTIONS
-- ============================================

-- Track OAuth connections
CREATE TABLE IF NOT EXISTS user_oauth_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'github', 'apple', 'microsoft', 'discord')),
  provider_user_id TEXT NOT NULL,
  provider_email TEXT,
  provider_data JSONB,
  connected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, provider),
  UNIQUE(provider, provider_user_id)
);

-- ============================================
-- 5. ACTIVITY & ANALYTICS
-- ============================================

-- User activity tracking
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================

-- Profile indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_settings ON user_profiles USING gin(settings);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_seen ON user_profiles(last_seen_at DESC);

-- Session sharing indexes
CREATE INDEX IF NOT EXISTS idx_sessions_visibility ON sessions(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_share_token ON sessions(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_invitations_invitee ON session_invitations(invitee_email, status);

-- Collaboration indexes
CREATE INDEX IF NOT EXISTS idx_collaboration_events_session_user ON collaboration_events(session_id, user_id, created_at DESC);

-- AI tool indexes
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_node ON ai_tool_calls(node_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_search_cache_query ON web_search_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_web_search_cache_expires ON web_search_cache(expires_at);

-- Activity indexes
CREATE INDEX IF NOT EXISTS idx_user_activities_user_time ON user_activities(user_id, created_at DESC);

-- ============================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on new tables
ALTER TABLE session_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_oauth_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

-- Session invitations policies
CREATE POLICY "Users can view invitations they sent or received" ON session_invitations
  FOR SELECT USING (
    auth.uid() = inviter_id OR 
    invitee_email = auth.email()
  );

CREATE POLICY "Session owners can send invitations" ON session_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE id = session_invitations.session_id 
      AND user_id = auth.uid()
    )
  );

-- Collaboration events policies
CREATE POLICY "Participants can view collaboration events" ON collaboration_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM session_participants 
      WHERE session_id = collaboration_events.session_id 
      AND user_id = auth.uid()
    )
  );

-- AI tool calls policies
CREATE POLICY "Users can view tool calls in their sessions" ON ai_tool_calls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_nodes cn
      JOIN sessions s ON cn.session_id = s.id
      WHERE cn.id = ai_tool_calls.node_id
      AND (s.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM session_participants sp
        WHERE sp.session_id = s.id AND sp.user_id = auth.uid()
      ))
    )
  );

-- Web search cache (public read for efficiency)
CREATE POLICY "Anyone can read search cache" ON web_search_cache
  FOR SELECT USING (true);

-- OAuth connections policies
CREATE POLICY "Users can view their own OAuth connections" ON user_oauth_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own OAuth connections" ON user_oauth_connections
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 8. FUNCTIONS & TRIGGERS
-- ============================================

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name, email_notifications)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'), true)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to update last_seen_at
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles 
  SET last_seen_at = CURRENT_TIMESTAMP
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_seen on activity
CREATE TRIGGER update_user_last_seen
  AFTER INSERT ON user_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_last_seen();

-- Function to clean expired data
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
  -- Delete expired invitations
  DELETE FROM session_invitations 
  WHERE status = 'pending' AND expires_at < CURRENT_TIMESTAMP;
  
  -- Delete expired search cache
  DELETE FROM web_search_cache 
  WHERE expires_at < CURRENT_TIMESTAMP;
  
  -- Delete old collaboration events (keep 30 days)
  DELETE FROM collaboration_events 
  WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. SYSTEM SETTINGS TABLE
-- ============================================

-- Create settings table first
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  category TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS for settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Settings policies (admin only for now)
CREATE POLICY IF NOT EXISTS "Settings are publicly readable" ON public.settings
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Only authenticated users can modify settings" ON public.settings
  FOR ALL USING (auth.role() = 'authenticated');

-- Insert default AI models configuration
INSERT INTO public.settings (key, value, category) VALUES
  ('ai_models', '{
    "openai": ["gpt-4o", "gpt-4", "gpt-3.5-turbo"],
    "anthropic": ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
    "google": ["gemini-pro", "gemini-pro-vision"]
  }'::jsonb, 'models'),
  ('search_providers', '{
    "perplexity": {"enabled": true, "api_key_required": true},
    "tavily": {"enabled": false, "api_key_required": true},
    "serper": {"enabled": false, "api_key_required": true}
  }'::jsonb, 'tools')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE session_invitations IS 'Manages session sharing invitations';
COMMENT ON TABLE collaboration_events IS 'Tracks real-time collaboration events';
COMMENT ON TABLE ai_tool_calls IS 'Logs AI tool/function usage';
COMMENT ON TABLE web_search_cache IS 'Caches web search results';
COMMENT ON TABLE user_oauth_connections IS 'Manages OAuth provider connections';
COMMENT ON TABLE user_activities IS 'Tracks user activity for analytics';