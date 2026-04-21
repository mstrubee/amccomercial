ALTER TABLE public.hitos_template_columns
  DROP CONSTRAINT IF EXISTS hitos_template_columns_checkbox_action_check;

ALTER TABLE public.hitos_template_columns
  ADD CONSTRAINT hitos_template_columns_checkbox_action_check
  CHECK (checkbox_action IN ('fijar_fecha_y_completar', 'solo_fecha', 'solo_completar', 'descartar'));