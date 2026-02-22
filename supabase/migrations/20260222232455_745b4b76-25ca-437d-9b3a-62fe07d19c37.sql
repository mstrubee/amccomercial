
-- Add commercial category fields to alertas table
ALTER TABLE public.alertas
ADD COLUMN categoria_proyecto_id uuid REFERENCES public.categorias_proyecto(id) ON DELETE SET NULL,
ADD COLUMN subcategoria_proyecto_id uuid REFERENCES public.subcategorias_proyecto(id) ON DELETE SET NULL;
