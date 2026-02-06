
-- Proyectos table
CREATE TABLE public.proyectos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero SERIAL,
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL DEFAULT '',
  comuna TEXT NOT NULL DEFAULT '',
  estado_obra TEXT NOT NULL DEFAULT '',
  fecha_estado_obra DATE,
  estado_amc TEXT NOT NULL DEFAULT 'Vigente',
  adjudicado BOOLEAN NOT NULL DEFAULT false,
  monto_estimado NUMERIC DEFAULT 0,
  -- Arquitectura
  arq_nombre TEXT DEFAULT '',
  arq_contacto TEXT DEFAULT '',
  arq_mail TEXT DEFAULT '',
  arq_telefono TEXT DEFAULT '',
  -- Constructora
  const_nombre TEXT DEFAULT '',
  const_contacto TEXT DEFAULT '',
  const_mail TEXT DEFAULT '',
  const_telefono TEXT DEFAULT '',
  -- ITO
  ito_nombre TEXT DEFAULT '',
  ito_contacto TEXT DEFAULT '',
  ito_mail TEXT DEFAULT '',
  ito_telefono TEXT DEFAULT '',
  -- Dueños
  duenos_nombre TEXT DEFAULT '',
  duenos_contacto TEXT DEFAULT '',
  duenos_mail TEXT DEFAULT '',
  duenos_telefono TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Many-to-many: proyectos <-> empresas
CREATE TABLE public.proyecto_empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  UNIQUE(proyecto_id, empresa_id)
);

-- RLS
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyecto_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to proyectos" ON public.proyectos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to proyecto_empresas" ON public.proyecto_empresas FOR ALL USING (true) WITH CHECK (true);

-- Trigger
CREATE TRIGGER update_proyectos_updated_at
  BEFORE UPDATE ON public.proyectos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
