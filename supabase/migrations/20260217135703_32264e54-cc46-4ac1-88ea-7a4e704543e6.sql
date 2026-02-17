
-- 1. Make carga-masiva-archivos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'carga-masiva-archivos';

-- 2. Fix proyectos RLS: replace overly permissive ALL policy with granular ones
DROP POLICY IF EXISTS "Authenticated can access proyectos" ON public.proyectos;

CREATE POLICY "Authenticated can read proyectos"
ON public.proyectos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and tipo1 can insert proyectos"
ON public.proyectos FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));

CREATE POLICY "Admins and tipo1 can update proyectos"
ON public.proyectos FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));

CREATE POLICY "Only admins can delete proyectos"
ON public.proyectos FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix proyecto_empresas RLS: replace overly permissive ALL policy
DROP POLICY IF EXISTS "Authenticated can access proyecto_empresas" ON public.proyecto_empresas;

CREATE POLICY "Authenticated can read proyecto_empresas"
ON public.proyecto_empresas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and tipo1 can insert proyecto_empresas"
ON public.proyecto_empresas FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));

CREATE POLICY "Admins and tipo1 can update proyecto_empresas"
ON public.proyecto_empresas FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));

CREATE POLICY "Only admins can delete proyecto_empresas"
ON public.proyecto_empresas FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
