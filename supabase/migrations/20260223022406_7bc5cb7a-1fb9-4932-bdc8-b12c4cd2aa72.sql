CREATE TABLE public.estados_proyecto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estados_proyecto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read estados_proyecto"
  ON public.estados_proyecto FOR SELECT USING (true);

CREATE POLICY "Admins can manage estados_proyecto"
  ON public.estados_proyecto FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.estados_proyecto (nombre, orden) VALUES
  ('Vigente', 1),
  ('Descartado', 2),
  ('Todo Ofrecido', 3),
  ('Sin Respuesta', 4);