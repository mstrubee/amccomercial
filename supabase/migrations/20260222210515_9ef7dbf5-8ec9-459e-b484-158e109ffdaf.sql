
-- Junction table for many-to-many alertas <-> clasificaciones
CREATE TABLE public.alerta_clasificaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alerta_id uuid NOT NULL REFERENCES public.alertas(id) ON DELETE CASCADE,
  clasificacion_id uuid NOT NULL REFERENCES public.clasificaciones_alerta(id) ON DELETE CASCADE,
  subclasificacion_id uuid REFERENCES public.subclasificaciones_alerta(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX uq_alerta_clasif ON public.alerta_clasificaciones(alerta_id, clasificacion_id, COALESCE(subclasificacion_id, '00000000-0000-0000-0000-000000000000'));

-- RLS
ALTER TABLE public.alerta_clasificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read alerta_clasificaciones"
ON public.alerta_clasificaciones FOR SELECT
USING (true);

CREATE POLICY "Authenticated can insert alerta_clasificaciones"
ON public.alerta_clasificaciones FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated can update alerta_clasificaciones"
ON public.alerta_clasificaciones FOR UPDATE
USING (true);

CREATE POLICY "Authenticated can delete alerta_clasificaciones"
ON public.alerta_clasificaciones FOR DELETE
USING (true);

-- Migrate existing data from single FK columns
INSERT INTO public.alerta_clasificaciones (alerta_id, clasificacion_id, subclasificacion_id)
SELECT id, clasificacion_alerta_id, subclasificacion_alerta_id
FROM public.alertas
WHERE clasificacion_alerta_id IS NOT NULL;
