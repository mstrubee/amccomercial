CREATE TABLE public.historial_estatus_empresa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_empresa_id UUID NOT NULL REFERENCES public.proyecto_empresas(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorias_proyecto(id) ON DELETE SET NULL,
  subcategoria_id UUID REFERENCES public.subcategorias_proyecto(id) ON DELETE SET NULL,
  monto_uf NUMERIC NOT NULL DEFAULT 0,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_historial_estatus_empresa_pe ON public.historial_estatus_empresa(proyecto_empresa_id);

ALTER TABLE public.historial_estatus_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read historial_estatus_empresa"
ON public.historial_estatus_empresa FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert historial_estatus_empresa"
ON public.historial_estatus_empresa FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can delete historial_estatus_empresa"
ON public.historial_estatus_empresa FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));