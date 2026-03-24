
-- Add proyecto_id column to empresa_checklist_items
ALTER TABLE public.empresa_checklist_items ADD COLUMN proyecto_id UUID REFERENCES public.proyectos(id) ON DELETE CASCADE;

-- Create index for common queries
CREATE INDEX idx_empresa_checklist_proyecto ON public.empresa_checklist_items(proyecto_id);
CREATE INDEX idx_empresa_checklist_empresa ON public.empresa_checklist_items(empresa_id);
