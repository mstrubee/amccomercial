
-- 1. messages: remove open SELECT policy (already absent in current state, but ensure)
DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON public.messages;

-- 2. user_permissions: remove captador self-write policies; add SECURITY DEFINER RPC for the project-creation merge
DROP POLICY IF EXISTS "Captadores can insert own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Captadores can update own permissions" ON public.user_permissions;

CREATE OR REPLACE FUNCTION public.captador_add_empresas_visibles(_empresa_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid[];
  _merged uuid[];
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_captador(_uid) THEN RAISE EXCEPTION 'Not a captador'; END IF;
  IF _empresa_ids IS NULL OR array_length(_empresa_ids, 1) IS NULL THEN RETURN; END IF;

  SELECT empresas_visibles INTO _existing FROM public.user_permissions WHERE user_id = _uid;

  IF _existing IS NULL THEN
    _merged := _empresa_ids;
  ELSE
    SELECT ARRAY(SELECT DISTINCT unnest(_existing || _empresa_ids)) INTO _merged;
  END IF;

  INSERT INTO public.user_permissions (user_id, empresas_visibles)
  VALUES (_uid, _merged)
  ON CONFLICT (user_id) DO UPDATE SET empresas_visibles = EXCLUDED.empresas_visibles;
END;
$$;

REVOKE ALL ON FUNCTION public.captador_add_empresas_visibles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.captador_add_empresas_visibles(uuid[]) TO authenticated;

-- 3. profiles: drop email column; restrict to display_name + presence only
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

-- 4. historial_estatus_empresa: restrict DELETE to creator or admin
DROP POLICY IF EXISTS "Authenticated can delete historial_estatus_empresa" ON public.historial_estatus_empresa;
CREATE POLICY "Creator or admin can delete historial_estatus_empresa"
ON public.historial_estatus_empresa FOR DELETE TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- 5. hitos_proyecto_empresa_extra_rows: restrict DELETE
DROP POLICY IF EXISTS "Authenticated can delete hitos_extra_rows" ON public.hitos_proyecto_empresa_extra_rows;
CREATE POLICY "Creator or admin can delete hitos_extra_rows"
ON public.hitos_proyecto_empresa_extra_rows FOR DELETE TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- 6. hitos_proyecto_empresa_values: restrict DELETE
DROP POLICY IF EXISTS "Authenticated can delete hitos_values" ON public.hitos_proyecto_empresa_values;
CREATE POLICY "Creator or admin can delete hitos_values"
ON public.hitos_proyecto_empresa_values FOR DELETE TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
