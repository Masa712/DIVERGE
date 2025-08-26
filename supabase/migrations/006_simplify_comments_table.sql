-- Simplified approach: Drop and recreate node_comments table with basic structure
-- This is a more drastic approach if the previous fixes don't work

-- Drop existing table and related objects
DROP TABLE IF EXISTS node_comments CASCADE;
DROP TABLE IF EXISTS comment_reactions CASCADE;

-- Create a simplified node_comments table
CREATE TABLE node_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id UUID NOT NULL REFERENCES chat_nodes(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_node_comments_node_id ON node_comments(node_id, created_at DESC);
CREATE INDEX idx_node_comments_session_id ON node_comments(session_id, created_at DESC);
CREATE INDEX idx_node_comments_user_id ON node_comments(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE node_comments ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies
-- Users can view comments in their own sessions
CREATE POLICY "Users can view comments in their sessions" ON node_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = node_comments.session_id
      AND s.user_id = auth.uid()
    )
  );

-- Users can create comments in their own sessions
CREATE POLICY "Users can create comments in their sessions" ON node_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = node_comments.session_id
      AND s.user_id = auth.uid()
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update their own comments" ON node_comments
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments" ON node_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_node_comments_updated_at
  BEFORE UPDATE ON node_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();