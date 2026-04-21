ALTER TABLE public.hitos_template_columns
  ADD COLUMN checkbox_action text NOT NULL DEFAULT 'fijar_fecha_y_completar',
  ADD COLUMN checkbox_color text NOT NULL DEFAULT '#22c55e';