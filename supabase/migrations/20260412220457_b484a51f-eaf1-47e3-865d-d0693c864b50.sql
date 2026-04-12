CREATE TABLE public.ventas_proyecto_empresa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_empresa_id UUID NOT NULL REFERENCES public.proyecto_empresas(id) ON DELETE CASCADE,
  monto_uf NUMERIC NOT NULL DEFAULT 0,
  descripcion TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ventas_proyecto_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ventas"
  ON public.ventas_proyecto_empresa
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and tipo1 can insert ventas"
  ON public.ventas_proyecto_empresa
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));

CREATE POLICY "Admins and tipo1 can update ventas"
  ON public.ventas_proyecto_empresa
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));

CREATE POLICY "Admins and tipo1 can delete ventas"
  ON public.ventas_proyecto_empresa
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));

CREATE INDEX idx_ventas_proyecto_empresa ON public.ventas_proyecto_empresa (proyecto_empresa_id);