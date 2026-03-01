
-- Fix messaging RLS: change from RESTRICTIVE to PERMISSIVE

-- conversations
DROP POLICY IF EXISTS "Authenticated can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can read conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;

CREATE POLICY "Authenticated can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Participants can read conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (public.is_conversation_participant(auth.uid(), id));

CREATE POLICY "Participants can update conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (public.is_conversation_participant(auth.uid(), id));

-- conversation_participants
DROP POLICY IF EXISTS "Authenticated can insert participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Participants can read own participation" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON public.conversation_participants;

CREATE POLICY "Authenticated can insert participants"
  ON public.conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Participants can read own participation"
  ON public.conversation_participants FOR SELECT
  TO authenticated
  USING (public.is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "Users can update own participation"
  ON public.conversation_participants FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- messages
DROP POLICY IF EXISTS "Participants can read messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;

CREATE POLICY "Participants can read messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (public.is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_participant(auth.uid(), conversation_id)
  );
