-- Templates: columns
CREATE TABLE public.hitos_template_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto','select')),
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hitos_template_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read hitos_template_columns" ON public.hitos_template_columns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage hitos_template_columns" ON public.hitos_template_columns FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Templates: column options
CREATE TABLE public.hitos_template_column_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id uuid NOT NULL REFERENCES public.hitos_template_columns(id) ON DELETE CASCADE,
  valor text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hitos_template_column_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read hitos_template_column_options" ON public.hitos_template_column_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage hitos_template_column_options" ON public.hitos_template_column_options FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Templates: rows
CREATE TABLE public.hitos_template_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hitos_template_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read hitos_template_rows" ON public.hitos_template_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage hitos_template_rows" ON public.hitos_template_rows FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Extra rows per proyecto_empresa
CREATE TABLE public.hitos_proyecto_empresa_extra_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_empresa_id uuid NOT NULL REFERENCES public.proyecto_empresas(id) ON DELETE CASCADE,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);
ALTER TABLE public.hitos_proyecto_empresa_extra_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read hitos_extra_rows" ON public.hitos_proyecto_empresa_extra_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin and tipo1 can insert hitos_extra_rows" ON public.hitos_proyecto_empresa_extra_rows FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'usuario_tipo_1'::app_role));
CREATE POLICY "Admin and tipo1 can update hitos_extra_rows" ON public.hitos_proyecto_empresa_extra_rows FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'usuario_tipo_1'::app_role));
CREATE POLICY "Admin and tipo1 can delete hitos_extra_rows" ON public.hitos_proyecto_empresa_extra_rows FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'usuario_tipo_1'::app_role));

-- Values
CREATE TABLE public.hitos_proyecto_empresa_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_empresa_id uuid NOT NULL REFERENCES public.proyecto_empresas(id) ON DELETE CASCADE,
  row_id uuid REFERENCES public.hitos_template_rows(id) ON DELETE CASCADE,
  extra_row_id uuid REFERENCES public.hitos_proyecto_empresa_extra_rows(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.hitos_template_columns(id) ON DELETE CASCADE,
  valor text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (row_id IS NOT NULL OR extra_row_id IS NOT NULL)
);
CREATE UNIQUE INDEX hitos_values_unique_template ON public.hitos_proyecto_empresa_values (proyecto_empresa_id, row_id, column_id) WHERE row_id IS NOT NULL;
CREATE UNIQUE INDEX hitos_values_unique_extra ON public.hitos_proyecto_empresa_values (proyecto_empresa_id, extra_row_id, column_id) WHERE extra_row_id IS NOT NULL;
CREATE INDEX hitos_values_pe_idx ON public.hitos_proyecto_empresa_values(proyecto_empresa_id);

ALTER TABLE public.hitos_proyecto_empresa_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read hitos_values" ON public.hitos_proyecto_empresa_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin and tipo1 can insert hitos_values" ON public.hitos_proyecto_empresa_values FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'usuario_tipo_1'::app_role));
CREATE POLICY "Admin and tipo1 can update hitos_values" ON public.hitos_proyecto_empresa_values FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'usuario_tipo_1'::app_role));
CREATE POLICY "Admin and tipo1 can delete hitos_values" ON public.hitos_proyecto_empresa_values FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'usuario_tipo_1'::app_role));

-- Trigger updated_at
CREATE TRIGGER hitos_values_updated_at BEFORE UPDATE ON public.hitos_proyecto_empresa_values FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial template
DO $$
DECLARE col_hito uuid; col_estado uuid; col_obs uuid;
BEGIN
  INSERT INTO public.hitos_template_columns (nombre, tipo, orden) VALUES ('Hito','texto',0) RETURNING id INTO col_hito;
  INSERT INTO public.hitos_template_columns (nombre, tipo, orden) VALUES ('Estado','select',1) RETURNING id INTO col_estado;
  INSERT INTO public.hitos_template_columns (nombre, tipo, orden) VALUES ('Observación','texto',2) RETURNING id INTO col_obs;

  INSERT INTO public.hitos_template_column_options (column_id, valor, orden) VALUES
    (col_estado,'Pendiente',0),
    (col_estado,'En curso',1),
    (col_estado,'Completado',2);

  INSERT INTO public.hitos_template_rows (orden) VALUES (0),(1),(2);
END $$;