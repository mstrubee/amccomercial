-- Restore team-wide (signed-in staff) write access on shared collaboration tables.
-- These are internal tables edited by the whole team; owner-only scoping caused
-- silent no-op updates. Scoped strictly to the authenticated role (never anon).

-- empresa_checklist_items
DROP POLICY IF EXISTS "empresa_checklist_items_insert_authenticated" ON public.empresa_checklist_items;
DROP POLICY IF EXISTS "empresa_checklist_items_update_authenticated" ON public.empresa_checklist_items;
DROP POLICY IF EXISTS "empresa_checklist_items_delete_authenticated" ON public.empresa_checklist_items;
CREATE POLICY "empresa_checklist_items_insert_authenticated" ON public.empresa_checklist_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "empresa_checklist_items_update_authenticated" ON public.empresa_checklist_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "empresa_checklist_items_delete_authenticated" ON public.empresa_checklist_items
  FOR DELETE TO authenticated USING (true);

-- hitos_proyecto_empresa_values
DROP POLICY IF EXISTS "hitos_values_insert_authenticated" ON public.hitos_proyecto_empresa_values;
DROP POLICY IF EXISTS "hitos_values_update_authenticated" ON public.hitos_proyecto_empresa_values;
DROP POLICY IF EXISTS "hitos_values_delete_authenticated" ON public.hitos_proyecto_empresa_values;
CREATE POLICY "hitos_values_insert_authenticated" ON public.hitos_proyecto_empresa_values
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "hitos_values_update_authenticated" ON public.hitos_proyecto_empresa_values
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hitos_values_delete_authenticated" ON public.hitos_proyecto_empresa_values
  FOR DELETE TO authenticated USING (true);

-- alerta_clasificaciones (junction table written on every alert save)
DROP POLICY IF EXISTS "alerta_clasificaciones_insert_authenticated" ON public.alerta_clasificaciones;
DROP POLICY IF EXISTS "alerta_clasificaciones_update_authenticated" ON public.alerta_clasificaciones;
DROP POLICY IF EXISTS "alerta_clasificaciones_delete_authenticated" ON public.alerta_clasificaciones;
CREATE POLICY "alerta_clasificaciones_insert_authenticated" ON public.alerta_clasificaciones
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "alerta_clasificaciones_update_authenticated" ON public.alerta_clasificaciones
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "alerta_clasificaciones_delete_authenticated" ON public.alerta_clasificaciones
  FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_checklist_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hitos_proyecto_empresa_values TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerta_clasificaciones TO authenticated;
