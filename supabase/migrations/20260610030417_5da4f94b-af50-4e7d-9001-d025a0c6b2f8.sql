
-- Helper function: is the current user a captador?
CREATE OR REPLACE FUNCTION public.is_captador(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.captadores WHERE user_id = _user_id)
$$;

-- proyectos: INSERT/UPDATE
DROP POLICY IF EXISTS "Captadores can insert proyectos" ON public.proyectos;
CREATE POLICY "Captadores can insert proyectos" ON public.proyectos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_captador(auth.uid()));

DROP POLICY IF EXISTS "Captadores can update proyectos" ON public.proyectos;
CREATE POLICY "Captadores can update proyectos" ON public.proyectos
  FOR UPDATE TO authenticated
  USING (public.is_captador(auth.uid()))
  WITH CHECK (public.is_captador(auth.uid()));

-- proyecto_empresas: INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Captadores can insert proyecto_empresas" ON public.proyecto_empresas;
CREATE POLICY "Captadores can insert proyecto_empresas" ON public.proyecto_empresas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_captador(auth.uid()));

DROP POLICY IF EXISTS "Captadores can update proyecto_empresas" ON public.proyecto_empresas;
CREATE POLICY "Captadores can update proyecto_empresas" ON public.proyecto_empresas
  FOR UPDATE TO authenticated
  USING (public.is_captador(auth.uid()))
  WITH CHECK (public.is_captador(auth.uid()));

DROP POLICY IF EXISTS "Captadores can delete proyecto_empresas" ON public.proyecto_empresas;
CREATE POLICY "Captadores can delete proyecto_empresas" ON public.proyecto_empresas
  FOR DELETE TO authenticated
  USING (public.is_captador(auth.uid()));

-- proyecto_captadores: INSERT (so captador can self-link upon project creation)
DROP POLICY IF EXISTS "Captadores can insert proyecto_captadores" ON public.proyecto_captadores;
CREATE POLICY "Captadores can insert proyecto_captadores" ON public.proyecto_captadores
  FOR INSERT TO authenticated
  WITH CHECK (public.is_captador(auth.uid()));

-- empresas: UPDATE
DROP POLICY IF EXISTS "Captadores can update empresas" ON public.empresas;
CREATE POLICY "Captadores can update empresas" ON public.empresas
  FOR UPDATE TO authenticated
  USING (public.is_captador(auth.uid()))
  WITH CHECK (public.is_captador(auth.uid()));

-- condiciones_comerciales: INSERT/UPDATE
DROP POLICY IF EXISTS "Captadores can insert condiciones" ON public.condiciones_comerciales;
CREATE POLICY "Captadores can insert condiciones" ON public.condiciones_comerciales
  FOR INSERT TO authenticated
  WITH CHECK (public.is_captador(auth.uid()));

DROP POLICY IF EXISTS "Captadores can update condiciones" ON public.condiciones_comerciales;
CREATE POLICY "Captadores can update condiciones" ON public.condiciones_comerciales
  FOR UPDATE TO authenticated
  USING (public.is_captador(auth.uid()))
  WITH CHECK (public.is_captador(auth.uid()));

-- user_permissions: allow captador to update own row (for empresas_visibles merge)
DROP POLICY IF EXISTS "Captadores can update own permissions" ON public.user_permissions;
CREATE POLICY "Captadores can update own permissions" ON public.user_permissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_captador(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_captador(auth.uid()));

DROP POLICY IF EXISTS "Captadores can insert own permissions" ON public.user_permissions;
CREATE POLICY "Captadores can insert own permissions" ON public.user_permissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_captador(auth.uid()));
