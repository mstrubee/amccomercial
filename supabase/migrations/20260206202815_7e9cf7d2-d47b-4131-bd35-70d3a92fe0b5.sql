
-- Empresas representadas
CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Activa' CHECK (estado IN ('Activa', 'Inactiva')),
  fecha_inicio_relacion DATE NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Condiciones comerciales versionadas
CREATE TABLE public.condiciones_comerciales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fee_fijo_mensual NUMERIC NOT NULL DEFAULT 0,
  esquema_comision NUMERIC NOT NULL DEFAULT 0,
  fecha_vigencia DATE NOT NULL DEFAULT now(),
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_condiciones_empresa ON public.condiciones_comerciales(empresa_id, fecha_vigencia DESC);

-- Enable RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condiciones_comerciales ENABLE ROW LEVEL SECURITY;

-- Public read/write for now (no auth required per user request)
CREATE POLICY "Allow all access to empresas" ON public.empresas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to condiciones" ON public.condiciones_comerciales FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
