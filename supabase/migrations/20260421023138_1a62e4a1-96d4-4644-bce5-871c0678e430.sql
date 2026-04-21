ALTER TABLE public.hitos_template_rows
ADD COLUMN parent_id uuid REFERENCES public.hitos_template_rows(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_hitos_template_rows_parent ON public.hitos_template_rows(parent_id);