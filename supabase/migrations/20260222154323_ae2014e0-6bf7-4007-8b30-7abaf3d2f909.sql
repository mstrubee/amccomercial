
-- 1. captadores table (same structure as clientes)
CREATE TABLE public.captadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id UUID NOT NULL REFERENCES public.categorias_cliente(id),
  nombre TEXT NOT NULL,
  contacto TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.captadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read captadores" ON public.captadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage captadores" ON public.captadores FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "usuario_tipo_1 can insert captadores" ON public.captadores FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'usuario_tipo_1'::app_role));
CREATE POLICY "usuario_tipo_1 can update captadores" ON public.captadores FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'usuario_tipo_1'::app_role));

CREATE TRIGGER update_captadores_updated_at BEFORE UPDATE ON public.captadores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. contactos_captador table (same structure as contactos_cliente)
CREATE TABLE public.contactos_captador (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  captador_id UUID NOT NULL REFERENCES public.captadores(id) ON DELETE CASCADE,
  contacto TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contactos_captador ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read contactos_captador" ON public.contactos_captador FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage contactos_captador" ON public.contactos_captador FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "usuario_tipo_1 can insert contactos_captador" ON public.contactos_captador FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'usuario_tipo_1'::app_role));
CREATE POLICY "usuario_tipo_1 can update contactos_captador" ON public.contactos_captador FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'usuario_tipo_1'::app_role));
CREATE POLICY "usuario_tipo_1 can delete contactos_captador" ON public.contactos_captador FOR DELETE TO authenticated USING (has_role(auth.uid(), 'usuario_tipo_1'::app_role));

-- 3. proyecto_clientes (many-to-many)
CREATE TABLE public.proyecto_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proyecto_id, cliente_id)
);

ALTER TABLE public.proyecto_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read proyecto_clientes" ON public.proyecto_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and tipo1 can insert proyecto_clientes" ON public.proyecto_clientes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));
CREATE POLICY "Admins and tipo1 can update proyecto_clientes" ON public.proyecto_clientes FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));
CREATE POLICY "Admins can delete proyecto_clientes" ON public.proyecto_clientes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. proyecto_captadores (many-to-many)
CREATE TABLE public.proyecto_captadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  captador_id UUID NOT NULL REFERENCES public.captadores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proyecto_id, captador_id)
);

ALTER TABLE public.proyecto_captadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read proyecto_captadores" ON public.proyecto_captadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and tipo1 can insert proyecto_captadores" ON public.proyecto_captadores FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));
CREATE POLICY "Admins and tipo1 can update proyecto_captadores" ON public.proyecto_captadores FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));
CREATE POLICY "Admins can delete proyecto_captadores" ON public.proyecto_captadores FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
