-- hitos_proyecto_empresa_extra_rows: ampliar a todos los autenticados
DROP POLICY IF EXISTS "Admin and tipo1 can insert hitos_extra_rows" ON public.hitos_proyecto_empresa_extra_rows;
DROP POLICY IF EXISTS "Admin and tipo1 can update hitos_extra_rows" ON public.hitos_proyecto_empresa_extra_rows;
DROP POLICY IF EXISTS "Admin and tipo1 can delete hitos_extra_rows" ON public.hitos_proyecto_empresa_extra_rows;

CREATE POLICY "Authenticated can insert hitos_extra_rows"
ON public.hitos_proyecto_empresa_extra_rows
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated can update hitos_extra_rows"
ON public.hitos_proyecto_empresa_extra_rows
FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete hitos_extra_rows"
ON public.hitos_proyecto_empresa_extra_rows
FOR DELETE TO authenticated
USING (true);

-- hitos_proyecto_empresa_values: ampliar a todos los autenticados
DROP POLICY IF EXISTS "Admin and tipo1 can insert hitos_values" ON public.hitos_proyecto_empresa_values;
DROP POLICY IF EXISTS "Admin and tipo1 can update hitos_values" ON public.hitos_proyecto_empresa_values;
DROP POLICY IF EXISTS "Admin and tipo1 can delete hitos_values" ON public.hitos_proyecto_empresa_values;

CREATE POLICY "Authenticated can insert hitos_values"
ON public.hitos_proyecto_empresa_values
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated can update hitos_values"
ON public.hitos_proyecto_empresa_values
FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete hitos_values"
ON public.hitos_proyecto_empresa_values
FOR DELETE TO authenticated
USING (true);