-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE node_status AS ENUM ('pending', 'streaming', 'completed', 'failed', 'cancelled');
CREATE TYPE user_action AS ENUM ('generate', 'retry', 'branch');

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  root_node_id UUID,
  total_cost_usd NUMERIC(10,4) DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  node_count INTEGER DEFAULT 0,
  max_depth INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ChatNodes table
CREATE TABLE chat_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES chat_nodes(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  system_prompt TEXT,
  prompt TEXT NOT NULL,
  response TEXT,
  status node_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  depth INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER DEFAULT 0,
  response_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,4) DEFAULT 0,
  temperature FLOAT,
  max_tokens INTEGER,
  top_p FLOAT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for root_node_id after chat_nodes table is created
ALTER TABLE sessions 
ADD CONSTRAINT fk_root_node 
FOREIGN KEY (root_node_id) REFERENCES chat_nodes(id) ON DELETE SET NULL;

-- UsageLog table
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  node_id UUID REFERENCES chat_nodes(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  action user_action NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  cost_usd NUMERIC(10,4) NOT NULL,
  latency_ms INTEGER,
  cache_hit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ContextCache table
CREATE TABLE context_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id UUID REFERENCES chat_nodes(id) ON DELETE CASCADE,
  context_hash TEXT UNIQUE NOT NULL,
  context TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- UserQuota table
CREATE TABLE user_quotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  token_quota INTEGER NOT NULL DEFAULT 50000,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cost_quota_usd NUMERIC(10,4) DEFAULT 10.00,
  cost_used_usd NUMERIC(10,4) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_chat_nodes_session_created ON chat_nodes(session_id, created_at);
CREATE INDEX idx_chat_nodes_parent ON chat_nodes(parent_id);
CREATE INDEX idx_chat_nodes_status ON chat_nodes(status);

CREATE INDEX idx_sessions_user_created ON sessions(user_id, created_at DESC);
CREATE INDEX idx_sessions_last_accessed ON sessions(last_accessed_at DESC);

CREATE INDEX idx_usage_logs_user_created ON usage_logs(user_id, created_at DESC);
CREATE INDEX idx_usage_logs_model_created ON usage_logs(model, created_at DESC);

CREATE INDEX idx_context_cache_node ON context_cache(node_id);
CREATE INDEX idx_context_cache_hash ON context_cache USING HASH(context_hash);
CREATE INDEX idx_context_cache_expires ON context_cache(expires_at);

CREATE INDEX idx_user_quotas_user_period ON user_quotas(user_id, period_start DESC);

-- Row Level Security (RLS)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
CREATE POLICY "Users can view their own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON sessions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat_nodes
CREATE POLICY "Users can view nodes from their sessions" ON chat_nodes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = chat_nodes.session_id 
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create nodes in their sessions" ON chat_nodes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = chat_nodes.session_id 
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update nodes in their sessions" ON chat_nodes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = chat_nodes.session_id 
      AND sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for usage_logs
CREATE POLICY "Users can view their own usage logs" ON usage_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage logs" ON usage_logs
  FOR INSERT WITH CHECK (true);

-- RLS Policies for context_cache
CREATE POLICY "Users can view cache for their nodes" ON context_cache
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_nodes 
      JOIN sessions ON sessions.id = chat_nodes.session_id
      WHERE chat_nodes.id = context_cache.node_id 
      AND sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for user_quotas
CREATE POLICY "Users can view their own quotas" ON user_quotas
  FOR SELECT USING (auth.uid() = user_id);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_chat_nodes_updated_at
  BEFORE UPDATE ON chat_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_quotas_updated_at
  BEFORE UPDATE ON user_quotas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();