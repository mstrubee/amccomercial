
-- Tabla de clasificaciones de alerta
CREATE TABLE public.clasificaciones_alerta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clasificaciones_alerta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read clasificaciones_alerta"
  ON public.clasificaciones_alerta FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage clasificaciones_alerta"
  ON public.clasificaciones_alerta FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Tabla de sub-clasificaciones de alerta
CREATE TABLE public.subclasificaciones_alerta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clasificacion_id UUID NOT NULL REFERENCES public.clasificaciones_alerta(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subclasificaciones_alerta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read subclasificaciones_alerta"
  ON public.subclasificaciones_alerta FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage subclasificaciones_alerta"
  ON public.subclasificaciones_alerta FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Columnas nuevas en alertas
ALTER TABLE public.alertas
  ADD COLUMN clasificacion_alerta_id UUID REFERENCES public.clasificaciones_alerta(id) ON DELETE SET NULL,
  ADD COLUMN subclasificacion_alerta_id UUID REFERENCES public.subclasificaciones_alerta(id) ON DELETE SET NULL;
