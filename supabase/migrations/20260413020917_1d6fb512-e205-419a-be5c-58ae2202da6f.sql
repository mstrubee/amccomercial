
-- Add estado_amc column to proyecto_empresas
ALTER TABLE public.proyecto_empresas
ADD COLUMN estado_amc text NOT NULL DEFAULT 'Vigente';

-- Migrate existing values from proyectos to proyecto_empresas
UPDATE public.proyecto_empresas pe
SET estado_amc = p.estado_amc
FROM public.proyectos p
WHERE pe.proyecto_id = p.id;
