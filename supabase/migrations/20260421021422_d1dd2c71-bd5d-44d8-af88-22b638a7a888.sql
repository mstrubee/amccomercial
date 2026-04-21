CREATE TABLE public.hitos_template_row_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id uuid NOT NULL REFERENCES public.hitos_template_rows(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.hitos_template_columns(id) ON DELETE CASCADE,
  valor text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (row_id, column_id)
);

ALTER TABLE public.hitos_template_row_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read hitos_template_row_defaults"
  ON public.hitos_template_row_defaults FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage hitos_template_row_defaults"
  ON public.hitos_template_row_defaults FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_hitos_template_row_defaults_row ON public.hitos_template_row_defaults(row_id);
CREATE INDEX idx_hitos_template_row_defaults_col ON public.hitos_template_row_defaults(column_id);