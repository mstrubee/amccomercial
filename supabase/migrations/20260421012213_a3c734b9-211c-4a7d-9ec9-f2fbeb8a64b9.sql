DROP POLICY IF EXISTS "Admins can delete historial_estatus_empresa" ON public.historial_estatus_empresa;

CREATE POLICY "Creator or admin can delete historial_estatus_empresa"
ON public.historial_estatus_empresa
FOR DELETE
TO authenticated
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));