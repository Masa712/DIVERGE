-- Fix RLS policy for session_participants table to allow trigger insertions
-- The trigger function runs in a security context that needs INSERT permission

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can insert participants" ON session_participants;
DROP POLICY IF EXISTS "Session owners can manage participants" ON session_participants;

-- Create a new policy that allows INSERT operations from triggers
-- This is needed because the add_session_owner_as_participant() function 
-- needs to insert records when a new session is created
CREATE POLICY "Allow trigger to insert participants" ON session_participants
  FOR INSERT 
  WITH CHECK (
    -- Allow if the user is inserting themselves as a participant
    auth.uid() = user_id
    OR
    -- Allow if the user owns the session (for the trigger function)
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_participants.session_id
      AND s.user_id = auth.uid()
    )
  );

-- Also add UPDATE and DELETE policies for session owners
CREATE POLICY "Session owners can update participants" ON session_participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_participants.session_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Session owners can delete participants" ON session_participants
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_participants.session_id
      AND s.user_id = auth.uid()
    )
  );

-- Ensure the trigger function uses SECURITY DEFINER to bypass RLS during trigger execution
-- This allows the trigger to insert records even when RLS would normally block it
DROP FUNCTION IF EXISTS add_session_owner_as_participant() CASCADE;

CREATE OR REPLACE FUNCTION add_session_owner_as_participant()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a new session is created, add the owner as a participant with full permissions
  INSERT INTO session_participants (session_id, user_id, role, permissions)
  VALUES (
    NEW.id,
    NEW.user_id,
    'owner',
    '{"can_comment": true, "can_edit_nodes": true, "can_invite": true, "can_delete": true}'::jsonb
  )
  ON CONFLICT (session_id, user_id) DO NOTHING;
  
  -- Also ensure user has a profile
  INSERT INTO user_profiles (id, display_name)
  VALUES (NEW.user_id, 'User')
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS session_owner_participant_trigger ON sessions;
CREATE TRIGGER session_owner_participant_trigger
  AFTER INSERT ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION add_session_owner_as_participant();

-- Test that the function works by ensuring existing sessions have participants
INSERT INTO session_participants (session_id, user_id, role, permissions)
SELECT 
  id as session_id,
  user_id,
  'owner' as role,
  '{"can_comment": true, "can_edit_nodes": true, "can_invite": true, "can_delete": true}'::jsonb as permissions
FROM sessions
WHERE NOT EXISTS (
  SELECT 1 FROM session_participants sp
  WHERE sp.session_id = sessions.id
  AND sp.user_id = sessions.user_id
)
ON CONFLICT (session_id, user_id) DO NOTHING;