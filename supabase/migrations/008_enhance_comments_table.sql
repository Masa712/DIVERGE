-- Enhance the simplified node_comments table with optional fields for future features
-- These columns are nullable so existing functionality won't break

-- Add optional columns to node_comments for future features
ALTER TABLE node_comments 
  ADD COLUMN IF NOT EXISTS comment_type TEXT DEFAULT 'user_comment',
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES node_comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE;

-- Add index for threaded comments
CREATE INDEX IF NOT EXISTS idx_node_comments_parent ON node_comments(parent_comment_id) 
  WHERE parent_comment_id IS NOT NULL;

-- Add index for pinned comments
CREATE INDEX IF NOT EXISTS idx_node_comments_pinned ON node_comments(is_pinned) 
  WHERE is_pinned = true;