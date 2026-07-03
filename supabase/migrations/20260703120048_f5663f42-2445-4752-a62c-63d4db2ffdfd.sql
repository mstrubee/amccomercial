
-- Tighten UPDATE policy on alertas: apply same conditions to WITH CHECK
DROP POLICY IF EXISTS "Responsible user, delegado, or admin can update alertas" ON public.alertas;
CREATE POLICY "Responsible user, delegado, or admin can update alertas"
ON public.alertas
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = usuario_responsable_id)
  OR (auth.uid() = created_by)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (EXISTS (
    SELECT 1 FROM delegaciones_alerta da
    WHERE da.delegado_id = auth.uid()
      AND da.delegante_id = alertas.usuario_responsable_id
      AND da.revocada = false
      AND da.fecha_inicio <= now()
      AND da.fecha_fin >= now()
  ))
)
WITH CHECK (
  (auth.uid() = usuario_responsable_id)
  OR (auth.uid() = created_by)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (EXISTS (
    SELECT 1 FROM delegaciones_alerta da
    WHERE da.delegado_id = auth.uid()
      AND da.delegante_id = alertas.usuario_responsable_id
      AND da.revocada = false
      AND da.fecha_inicio <= now()
      AND da.fecha_fin >= now()
  ))
);

-- Restrict user_google_tokens policies to authenticated role
DROP POLICY IF EXISTS "Users can read own google tokens" ON public.user_google_tokens;
DROP POLICY IF EXISTS "Users can insert own google tokens" ON public.user_google_tokens;
DROP POLICY IF EXISTS "Users can update own google tokens" ON public.user_google_tokens;
DROP POLICY IF EXISTS "Users can delete own google tokens" ON public.user_google_tokens;

CREATE POLICY "Users can read own google tokens" ON public.user_google_tokens
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own google tokens" ON public.user_google_tokens
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own google tokens" ON public.user_google_tokens
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own google tokens" ON public.user_google_tokens
FOR DELETE TO authenticated USING (auth.uid() = user_id);
