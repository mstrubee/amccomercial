
-- Add permite_fecha flag to categorias_proyecto
ALTER TABLE public.categorias_proyecto ADD COLUMN permite_fecha boolean NOT NULL DEFAULT false;

-- Add fecha_categoria to proyecto_empresas
ALTER TABLE public.proyecto_empresas ADD COLUMN fecha_categoria date NULL;
