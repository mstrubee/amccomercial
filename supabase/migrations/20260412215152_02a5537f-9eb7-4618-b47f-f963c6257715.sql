CREATE TABLE public.estados_amc (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.estados_amc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read estados_amc"
  ON public.estados_amc FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage estados_amc"
  ON public.estados_amc FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));