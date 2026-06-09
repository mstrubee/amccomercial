
-- Restrict taxonomy reads to authenticated users only
DROP POLICY IF EXISTS "Authenticated can read titulos_alerta" ON public.titulos_alerta;
CREATE POLICY "Authenticated can read titulos_alerta" ON public.titulos_alerta
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read subclasificaciones_alerta" ON public.subclasificaciones_alerta;
CREATE POLICY "Authenticated can read subclasificaciones_alerta" ON public.subclasificaciones_alerta
  FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.titulos_alerta FROM anon;
REVOKE SELECT ON public.subclasificaciones_alerta FROM anon;

-- Restrict Realtime channel subscriptions to authenticated users
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);
