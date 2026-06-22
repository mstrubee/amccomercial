-- 1) admin_notas: allow users to read their own notes
CREATE POLICY "Users can read own admin notas"
ON public.admin_notas
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2) conversation_participants: only self-insert; admins can insert any
DROP POLICY IF EXISTS "Authenticated can insert participants" ON public.conversation_participants;

CREATE POLICY "Users can add themselves as participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can add any participant"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3) messages: remove the open realtime SELECT policy
DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON public.messages;

-- 4) user_google_tokens: hide access_token from clients (edge functions use service_role and keep access)
REVOKE SELECT (access_token) ON public.user_google_tokens FROM authenticated;
REVOKE SELECT (access_token) ON public.user_google_tokens FROM anon;
REVOKE INSERT (access_token), UPDATE (access_token) ON public.user_google_tokens FROM authenticated;
REVOKE INSERT (access_token), UPDATE (access_token) ON public.user_google_tokens FROM anon;