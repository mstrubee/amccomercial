
-- Create alertas table
CREATE TABLE public.alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  texto VARCHAR(100) NOT NULL,
  usuario_responsable_id UUID NOT NULL,
  fecha_seguimiento DATE NOT NULL,
  completada BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read alertas
CREATE POLICY "Authenticated can read alertas"
ON public.alertas FOR SELECT
TO authenticated
USING (true);

-- All authenticated users can create alertas
CREATE POLICY "Authenticated can insert alertas"
ON public.alertas FOR INSERT
TO authenticated
WITH CHECK (true);

-- Users can update alertas they are responsible for, or admins can update any
CREATE POLICY "Responsible user or admin can update alertas"
ON public.alertas FOR UPDATE
TO authenticated
USING (
  auth.uid() = usuario_responsable_id 
  OR auth.uid() = created_by 
  OR public.has_role(auth.uid(), 'admin')
);

-- Only admins or creators can delete alertas
CREATE POLICY "Creator or admin can delete alertas"
ON public.alertas FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by 
  OR public.has_role(auth.uid(), 'admin')
);

-- Trigger for updated_at
CREATE TRIGGER update_alertas_updated_at
BEFORE UPDATE ON public.alertas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
