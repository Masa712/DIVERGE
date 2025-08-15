-- Add function to efficiently get node ancestors using recursive CTE
CREATE OR REPLACE FUNCTION get_node_ancestors(node_id UUID)
RETURNS TABLE (
  id UUID,
  parent_id UUID,
  session_id UUID,
  model TEXT,
  system_prompt TEXT,
  prompt TEXT,
  response TEXT,
  status node_status,
  error_message TEXT,
  depth INTEGER,
  prompt_tokens INTEGER,
  response_tokens INTEGER,
  cost_usd NUMERIC(10,4),
  temperature FLOAT,
  max_tokens INTEGER,
  top_p FLOAT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE ancestors AS (
    -- Base case: start with the given node
    SELECT 
      n.id, n.parent_id, n.session_id, n.model, n.system_prompt,
      n.prompt, n.response, n.status, n.error_message, n.depth,
      n.prompt_tokens, n.response_tokens, n.cost_usd, n.temperature,
      n.max_tokens, n.top_p, n.metadata, n.created_at, n.updated_at
    FROM chat_nodes n
    WHERE n.id = node_id
    
    UNION ALL
    
    -- Recursive case: get parent nodes
    SELECT 
      n.id, n.parent_id, n.session_id, n.model, n.system_prompt,
      n.prompt, n.response, n.status, n.error_message, n.depth,
      n.prompt_tokens, n.response_tokens, n.cost_usd, n.temperature,
      n.max_tokens, n.top_p, n.metadata, n.created_at, n.updated_at
    FROM chat_nodes n
    INNER JOIN ancestors a ON n.id = a.parent_id
  )
  SELECT * FROM ancestors ORDER BY depth ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_node_ancestors(UUID) TO authenticated;
