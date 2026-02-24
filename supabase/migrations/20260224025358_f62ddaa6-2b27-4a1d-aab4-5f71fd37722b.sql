-- Drop the old update policy
DROP POLICY "Responsible user or admin can update alertas" ON public.alertas;

-- Create a new update policy that also allows delegated users
CREATE POLICY "Responsible user, delegado, or admin can update alertas"
ON public.alertas
FOR UPDATE
USING (
  auth.uid() = usuario_responsable_id
  OR auth.uid() = created_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.delegaciones_alerta da
    WHERE da.delegado_id = auth.uid()
      AND da.delegante_id = alertas.usuario_responsable_id
      AND da.revocada = false
      AND da.fecha_inicio <= now()
      AND da.fecha_fin >= now()
  )
)
WITH CHECK (true);