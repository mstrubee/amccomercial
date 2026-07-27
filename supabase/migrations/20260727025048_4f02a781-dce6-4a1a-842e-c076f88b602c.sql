DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON public.messages;
DROP POLICY IF EXISTS "Anyone authenticated can read roles" ON public.user_roles;