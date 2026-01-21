-- ============================================
-- Remove Unused User Notes View
-- Removes the SECURITY DEFINER view that is not being used
-- ============================================

-- Drop the unused view to eliminate security risk
-- The application queries chat_nodes directly with proper RLS and authentication
DROP VIEW IF EXISTS user_notes_view;

-- Note: The GIN index on metadata->'nodeType' is still useful and retained
-- It is used by the application for efficient queries:
-- SELECT * FROM chat_nodes WHERE metadata->>'nodeType' = 'user_note'

-- If a view is needed in the future, use SECURITY INVOKER to preserve RLS:
-- CREATE VIEW user_notes_view
-- WITH (security_invoker = true) AS
-- SELECT
--   id,
--   parent_id,
--   session_id,
--   prompt as content,
--   metadata->>'noteTitle' as title,
--   metadata->'noteTags' as tags,
--   created_at,
--   updated_at
-- FROM chat_nodes
-- WHERE metadata->>'nodeType' = 'user_note'
--   AND status = 'completed';
