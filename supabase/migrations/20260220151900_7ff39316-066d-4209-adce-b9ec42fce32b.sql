DROP POLICY IF EXISTS "Responsible user or admin can update alertas" ON public.alertas;

CREATE POLICY "Responsible user or admin can update alertas"
ON public.alertas FOR UPDATE TO authenticated
USING (
  (auth.uid() = usuario_responsable_id)
  OR (auth.uid() = created_by)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (true);