-- Check and fix node_comments table structure

-- First, check if the metadata column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'node_comments' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE node_comments ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Also ensure all required columns exist
DO $$ 
BEGIN
  -- Check and add edit_history if missing
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'node_comments' 
    AND column_name = 'edit_history'
  ) THEN
    ALTER TABLE node_comments ADD COLUMN edit_history JSONB DEFAULT '[]';
  END IF;

  -- Check and add mentions if missing
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'node_comments' 
    AND column_name = 'mentions'
  ) THEN
    ALTER TABLE node_comments ADD COLUMN mentions JSONB DEFAULT '[]';
  END IF;

  -- Check and add reactions if missing
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'node_comments' 
    AND column_name = 'reactions'
  ) THEN
    ALTER TABLE node_comments ADD COLUMN reactions JSONB DEFAULT '{}';
  END IF;
END $$;

-- Drop the views that have security warnings (we'll recreate them safely)
DROP VIEW IF EXISTS session_comment_summary CASCADE;
DROP VIEW IF EXISTS user_comment_activity CASCADE;

-- Recreate views without SECURITY DEFINER
CREATE OR REPLACE VIEW session_comment_summary AS
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

CREATE OR REPLACE VIEW user_comment_activity AS
SELECT 
  up.id as user_id,
  up.display_name,
  COUNT(nc.id) as total_comments,
  COUNT(DISTINCT nc.session_id) as sessions_commented,
  MAX(nc.created_at) as last_comment_at
FROM user_profiles up
LEFT JOIN node_comments nc ON nc.user_id = up.id
GROUP BY up.id, up.display_name;

-- Grant appropriate permissions on views
GRANT SELECT ON session_comment_summary TO authenticated;
GRANT SELECT ON user_comment_activity TO authenticated;

-- Show current structure of node_comments table for verification
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'node_comments'
ORDER BY ordinal_position;