
-- 1. Enable RLS on backup/fusion tables (admin-only access)
ALTER TABLE public._fusion_map_20260717 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._fusion_vinculos_20260717 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._fusion_clientes_20260717 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._fusion_contactos_20260717 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._fusion_vinculos_insertados_20260717 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._recup_clientes_backup_20260717 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_fusion_map" ON public._fusion_map_20260717 FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin_all_fusion_vinculos" ON public._fusion_vinculos_20260717 FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin_all_fusion_clientes" ON public._fusion_clientes_20260717 FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin_all_fusion_contactos" ON public._fusion_contactos_20260717 FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin_all_fusion_vinc_ins" ON public._fusion_vinculos_insertados_20260717 FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin_all_recup_clientes" ON public._recup_clientes_backup_20260717 FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2. Tighten alerta_clasificaciones write policies to admin/usuario_tipo_1
DROP POLICY IF EXISTS "Insert alerta_clasificaciones" ON public.alerta_clasificaciones;
DROP POLICY IF EXISTS "Update alerta_clasificaciones" ON public.alerta_clasificaciones;
DROP POLICY IF EXISTS "Delete alerta_clasificaciones" ON public.alerta_clasificaciones;
DROP POLICY IF EXISTS "alerta_clasificaciones_insert" ON public.alerta_clasificaciones;
DROP POLICY IF EXISTS "alerta_clasificaciones_update" ON public.alerta_clasificaciones;
DROP POLICY IF EXISTS "alerta_clasificaciones_delete" ON public.alerta_clasificaciones;

CREATE POLICY "alerta_clasificaciones_write_admin" ON public.alerta_clasificaciones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'usuario_tipo_1'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'usuario_tipo_1'));

-- 3. Tighten empresa_checklist_items: creator or admin can modify
DROP POLICY IF EXISTS "empresa_checklist_items_insert" ON public.empresa_checklist_items;
DROP POLICY IF EXISTS "empresa_checklist_items_update" ON public.empresa_checklist_items;
DROP POLICY IF EXISTS "empresa_checklist_items_delete" ON public.empresa_checklist_items;
DROP POLICY IF EXISTS "Insert empresa_checklist_items" ON public.empresa_checklist_items;
DROP POLICY IF EXISTS "Update empresa_checklist_items" ON public.empresa_checklist_items;
DROP POLICY IF EXISTS "Delete empresa_checklist_items" ON public.empresa_checklist_items;

CREATE POLICY "empresa_checklist_items_insert_auth" ON public.empresa_checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "empresa_checklist_items_update_owner_or_admin" ON public.empresa_checklist_items
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "empresa_checklist_items_delete_owner_or_admin" ON public.empresa_checklist_items
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));

-- 4. hitos_proyecto_empresa_extra_rows: restrict UPDATE
DROP POLICY IF EXISTS "Update hitos_proyecto_empresa_extra_rows" ON public.hitos_proyecto_empresa_extra_rows;
DROP POLICY IF EXISTS "hitos_extra_rows_update" ON public.hitos_proyecto_empresa_extra_rows;
CREATE POLICY "hitos_extra_rows_update_owner_admin" ON public.hitos_proyecto_empresa_extra_rows
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));

-- 5. hitos_proyecto_empresa_values: restrict UPDATE
DROP POLICY IF EXISTS "Update hitos_proyecto_empresa_values" ON public.hitos_proyecto_empresa_values;
DROP POLICY IF EXISTS "hitos_values_update" ON public.hitos_proyecto_empresa_values;
CREATE POLICY "hitos_values_update_owner_admin" ON public.hitos_proyecto_empresa_values
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));

-- 6. user_roles SELECT: only self or admin
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "Select user_roles" ON public.user_roles;
CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- 7. Function search_path mutable: set search_path on functions missing it
ALTER FUNCTION public.update_cliente_full(uuid, uuid, text, jsonb) SET search_path = public;
ALTER FUNCTION public.update_captador_full(uuid, uuid, text, jsonb) SET search_path = public;
