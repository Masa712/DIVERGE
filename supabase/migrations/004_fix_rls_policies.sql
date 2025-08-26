-- Fix infinite recursion in RLS policies for session_participants

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view participants in their sessions" ON session_participants;
DROP POLICY IF EXISTS "Users can view comments in sessions they participate in" ON node_comments;

-- Recreate session_participants view policy without recursion
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

-- Simplify node_comments policy to avoid checking session_participants
CREATE POLICY "Users can view comments in their sessions" ON node_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = node_comments.session_id
      AND s.user_id = auth.uid()
    )
  );

-- Also update the insert policy for node_comments
DROP POLICY IF EXISTS "Users can create comments in sessions they can comment in" ON node_comments;

CREATE POLICY "Users can create comments in their sessions" ON node_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id -- Users can only create comments as themselves
    AND
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = node_comments.session_id
      AND s.user_id = auth.uid()
    )
  );

-- Make sure the trigger for adding session owner as participant doesn't cause issues
-- Drop and recreate it to ensure it's clean
DROP TRIGGER IF EXISTS session_owner_participant_trigger ON sessions;
DROP FUNCTION IF EXISTS add_session_owner_as_participant();

-- Recreate the function with better error handling
CREATE OR REPLACE FUNCTION add_session_owner_as_participant()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new session is created, add the owner as a participant with full permissions
  -- Use ON CONFLICT to avoid errors if participant already exists
  INSERT INTO session_participants (session_id, user_id, role, permissions)
  VALUES (
    NEW.id,
    NEW.user_id,
    'owner',
    '{"can_comment": true, "can_edit_nodes": true, "can_invite": true, "can_delete": true}'::jsonb
  )
  ON CONFLICT (session_id, user_id) DO UPDATE
  SET 
    role = 'owner',
    permissions = '{"can_comment": true, "can_edit_nodes": true, "can_invite": true, "can_delete": true}'::jsonb,
    last_active_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_owner_participant_trigger
  AFTER INSERT ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION add_session_owner_as_participant();

-- Also add participants for existing sessions (if not already added)
INSERT INTO session_participants (session_id, user_id, role, permissions)
SELECT 
  id as session_id,
  user_id,
  'owner' as role,
  '{"can_comment": true, "can_edit_nodes": true, "can_invite": true, "can_delete": true}'::jsonb as permissions
FROM sessions
ON CONFLICT (session_id, user_id) DO NOTHING;