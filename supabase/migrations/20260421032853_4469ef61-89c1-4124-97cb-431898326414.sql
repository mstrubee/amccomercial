ALTER TABLE public.hitos_template_columns
ADD COLUMN IF NOT EXISTS editable_en_proyecto boolean NOT NULL DEFAULT true;