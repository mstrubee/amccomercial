-- 1. Remove overly permissive "true" write policies
DROP POLICY IF EXISTS "Authenticated can insert alerta_clasificaciones" ON public.alerta_clasificaciones;
DROP POLICY IF EXISTS "Authenticated can update alerta_clasificaciones" ON public.alerta_clasificaciones;
DROP POLICY IF EXISTS "Authenticated can delete alerta_clasificaciones" ON public.alerta_clasificaciones;

DROP POLICY IF EXISTS "Authenticated can insert empresa_checklist_items" ON public.empresa_checklist_items;
DROP POLICY IF EXISTS "Authenticated can update empresa_checklist_items" ON public.empresa_checklist_items;
DROP POLICY IF EXISTS "Authenticated can delete empresa_checklist_items" ON public.empresa_checklist_items;

DROP POLICY IF EXISTS "Authenticated can update hitos_values" ON public.hitos_proyecto_empresa_values;

-- 2. Scope policies to the authenticated role instead of public
ALTER POLICY "Authenticated users can view sample files" ON public.archivos_muestra TO authenticated;
ALTER POLICY "Admins can insert sample files" ON public.archivos_muestra TO authenticated;
ALTER POLICY "Admins can delete sample files" ON public.archivos_muestra TO authenticated;

ALTER POLICY "Admins can read activity_log" ON public.activity_log TO authenticated;
ALTER POLICY "Admins can delete activity_log" ON public.activity_log TO authenticated;
ALTER POLICY "Users can insert own activity" ON public.activity_log TO authenticated;

ALTER POLICY "Admin manages notes" ON public.admin_notas TO authenticated;
ALTER POLICY "Admins can manage app_settings" ON public.app_settings TO authenticated;
ALTER POLICY "Admins can manage categorias_cliente" ON public.categorias_cliente TO authenticated;

ALTER POLICY "Admins can delete chat preferences" ON public.chat_preferences TO authenticated;
ALTER POLICY "Admins can read all chat preferences" ON public.chat_preferences TO authenticated;
ALTER POLICY "Users can insert own chat preferences" ON public.chat_preferences TO authenticated;
ALTER POLICY "Users can read own chat preferences" ON public.chat_preferences TO authenticated;
ALTER POLICY "Users can update own chat preferences" ON public.chat_preferences TO authenticated;

ALTER POLICY "Admins can manage clasificaciones_alerta" ON public.clasificaciones_alerta TO authenticated;
ALTER POLICY "Admins can manage subclasificaciones_alerta" ON public.subclasificaciones_alerta TO authenticated;
ALTER POLICY "Admins can manage titulos_alerta" ON public.titulos_alerta TO authenticated;
ALTER POLICY "Admins can manage estados_amc" ON public.estados_amc TO authenticated;

ALTER POLICY "Admins can manage clientes" ON public.clientes TO authenticated;
ALTER POLICY "usuario_tipo_1 can insert clientes" ON public.clientes TO authenticated;
ALTER POLICY "usuario_tipo_1 can update clientes" ON public.clientes TO authenticated;

ALTER POLICY "Admins can manage contactos_cliente" ON public.contactos_cliente TO authenticated;
ALTER POLICY "usuario_tipo_1 can insert contactos_cliente" ON public.contactos_cliente TO authenticated;
ALTER POLICY "usuario_tipo_1 can update contactos_cliente" ON public.contactos_cliente TO authenticated;
ALTER POLICY "usuario_tipo_1 can delete contactos_cliente" ON public.contactos_cliente TO authenticated;

ALTER POLICY "Admins can manage delegaciones" ON public.delegaciones_alerta TO authenticated;
ALTER POLICY "Users can read own delegaciones" ON public.delegaciones_alerta TO authenticated;

ALTER POLICY "Users can read own permissions" ON public.user_permissions TO authenticated;