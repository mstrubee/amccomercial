
-- Fix: captadores_email_phone_public
-- Drop overly permissive SELECT policies on captadores and contactos_captador
DROP POLICY IF EXISTS "Authenticated can read captadores" ON public.captadores;
DROP POLICY IF EXISTS "Authenticated can read contactos_captador" ON public.contactos_captador;

-- Restrict captadores SELECT to admins, usuario_tipo_1, and the captador themselves
CREATE POLICY "Admins and tipo1 can read captadores"
ON public.captadores
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'usuario_tipo_1'::app_role)
  OR auth.uid() = user_id
);

-- Restrict contactos_captador SELECT to admins and usuario_tipo_1
CREATE POLICY "Admins and tipo1 can read contactos_captador"
ON public.contactos_captador
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'usuario_tipo_1'::app_role)
);

-- Fix: condiciones_comerciales_public_read
DROP POLICY IF EXISTS "Authenticated can read condiciones" ON public.condiciones_comerciales;

CREATE POLICY "Admins and tipo1 can read condiciones"
ON public.condiciones_comerciales
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'usuario_tipo_1'::app_role)
);

-- Fix: messages_realtime_public_select
-- Defensive: drop the overly permissive realtime SELECT policy if it still exists.
-- The participant-scoped SELECT policy ("Participants or admin can read messages")
-- already covers Realtime subscribers correctly.
DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON public.messages;
