
-- Fix: Make conversation_participants INSERT permissive for all authenticated users
-- Drop the restrictive policies that block non-admins
DROP POLICY IF EXISTS "Admins can insert participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Authenticated can insert participants" ON public.conversation_participants;

-- Create a single PERMISSIVE insert policy for all authenticated users
CREATE POLICY "Authenticated can insert participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also fix messages INSERT: make it permissive so participants can send
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;

CREATE POLICY "Participants can send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id 
  AND is_conversation_participant(auth.uid(), conversation_id)
);

-- Fix messages SELECT to be permissive
DROP POLICY IF EXISTS "Participants or admin can read messages" ON public.messages;

CREATE POLICY "Participants or admin can read messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  is_conversation_participant(auth.uid(), conversation_id) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix messages UPDATE (mark read) to be permissive
DROP POLICY IF EXISTS "Participants can mark read" ON public.messages;

CREATE POLICY "Participants can mark read"
ON public.messages
FOR UPDATE
TO authenticated
USING (is_conversation_participant(auth.uid(), conversation_id))
WITH CHECK (is_conversation_participant(auth.uid(), conversation_id));

-- Fix messages DELETE to be permissive for admins
DROP POLICY IF EXISTS "Admins can delete messages" ON public.messages;

CREATE POLICY "Admins can delete messages"
ON public.messages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix conversation_participants SELECT policies to be permissive
DROP POLICY IF EXISTS "Admins can read participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Participants can read own participation" ON public.conversation_participants;

CREATE POLICY "Participants can read own participation"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (
  is_conversation_participant(auth.uid(), conversation_id) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix conversation_participants UPDATE to be permissive  
DROP POLICY IF EXISTS "Admins can update participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON public.conversation_participants;

CREATE POLICY "Users can update own participation"
ON public.conversation_participants
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix conversation_participants DELETE for admins
DROP POLICY IF EXISTS "Admins can delete conversation participants" ON public.conversation_participants;

CREATE POLICY "Admins can delete conversation participants"
ON public.conversation_participants
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix conversations policies to be permissive
DROP POLICY IF EXISTS "Participants or admin can read conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants or admin can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins can delete conversations" ON public.conversations;

CREATE POLICY "Participants or admin can read conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  is_conversation_participant(auth.uid(), id) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Authenticated can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Participants or admin can update conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  is_conversation_participant(auth.uid(), id) 
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  is_conversation_participant(auth.uid(), id) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete conversations"
ON public.conversations
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
