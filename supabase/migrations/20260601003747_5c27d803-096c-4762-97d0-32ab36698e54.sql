-- Fix: condiciones_comerciales fully writable by public
DROP POLICY IF EXISTS "Allow all access to condiciones" ON public.condiciones_comerciales;

-- Fix: clientes public read -> authenticated only
DROP POLICY IF EXISTS "Authenticated can read clientes" ON public.clientes;
CREATE POLICY "Authenticated can read clientes"
  ON public.clientes FOR SELECT TO authenticated USING (true);

-- Fix: contactos_cliente public read -> authenticated only
DROP POLICY IF EXISTS "Authenticated can read contactos_cliente" ON public.contactos_cliente;
CREATE POLICY "Authenticated can read contactos_cliente"
  ON public.contactos_cliente FOR SELECT TO authenticated USING (true);

-- Fix: alerta_clasificaciones public CRUD -> authenticated only
DROP POLICY IF EXISTS "Authenticated can read alerta_clasificaciones" ON public.alerta_clasificaciones;
DROP POLICY IF EXISTS "Authenticated can insert alerta_clasificaciones" ON public.alerta_clasificaciones;
DROP POLICY IF EXISTS "Authenticated can update alerta_clasificaciones" ON public.alerta_clasificaciones;
DROP POLICY IF EXISTS "Authenticated can delete alerta_clasificaciones" ON public.alerta_clasificaciones;
CREATE POLICY "Authenticated can read alerta_clasificaciones"
  ON public.alerta_clasificaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert alerta_clasificaciones"
  ON public.alerta_clasificaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update alerta_clasificaciones"
  ON public.alerta_clasificaciones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete alerta_clasificaciones"
  ON public.alerta_clasificaciones FOR DELETE TO authenticated USING (true);

-- Fix: reference tables public read -> authenticated only
DROP POLICY IF EXISTS "Authenticated can read categorias_cliente" ON public.categorias_cliente;
CREATE POLICY "Authenticated can read categorias_cliente"
  ON public.categorias_cliente FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read estados_amc" ON public.estados_amc;
CREATE POLICY "Authenticated can read estados_amc"
  ON public.estados_amc FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read estados_proyecto" ON public.estados_proyecto;
CREATE POLICY "Authenticated can read estados_proyecto"
  ON public.estados_proyecto FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read clasificaciones_alerta" ON public.clasificaciones_alerta;
CREATE POLICY "Authenticated can read clasificaciones_alerta"
  ON public.clasificaciones_alerta FOR SELECT TO authenticated USING (true);

-- Fix: function search_path mutable for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;