-- Add titulo column to alertas
ALTER TABLE public.alertas ADD COLUMN titulo varchar(100) NOT NULL DEFAULT '';

-- Create table for admin-manageable title options
CREATE TABLE public.titulos_alerta (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre varchar(100) NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.titulos_alerta ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "Authenticated can read titulos_alerta"
  ON public.titulos_alerta FOR SELECT
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage titulos_alerta"
  ON public.titulos_alerta FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
