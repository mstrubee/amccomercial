DROP POLICY IF EXISTS "Creator or admin can delete historial_estatus_empresa" ON public.historial_estatus_empresa;

CREATE POLICY "Authenticated can delete historial_estatus_empresa"
ON public.historial_estatus_empresa
FOR DELETE
TO authenticated
USING (true);