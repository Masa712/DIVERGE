-- ============================================
-- User Notes Support Migration
-- Adds support for user-created note nodes
-- ============================================

-- chat_nodes テーブル自体は変更不要（metadata JSONB フィールドを活用）
-- インデックスを追加して検索を高速化

-- nodeType によるインデックス追加
CREATE INDEX IF NOT EXISTS idx_chat_nodes_node_type
ON chat_nodes USING gin((metadata->'nodeType'));

-- ユーザーノートのみを取得するビュー（オプション）
CREATE OR REPLACE VIEW user_notes_view AS
SELECT
  id,
  parent_id,
  session_id,
  prompt as content,
  metadata->>'noteTitle' as title,
  metadata->'noteTags' as tags,
  created_at,
  updated_at
FROM chat_nodes
WHERE metadata->>'nodeType' = 'user_note'
  AND status = 'completed';

-- コメント追加
COMMENT ON VIEW user_notes_view IS 'View for accessing user-created note nodes';

-- 統計情報更新
ANALYZE chat_nodes;
