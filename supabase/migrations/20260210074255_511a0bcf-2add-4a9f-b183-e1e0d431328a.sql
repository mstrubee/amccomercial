
CREATE TABLE public.archivos_muestra (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  path TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.archivos_muestra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sample files"
ON public.archivos_muestra FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert sample files"
ON public.archivos_muestra FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sample files"
ON public.archivos_muestra FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));
