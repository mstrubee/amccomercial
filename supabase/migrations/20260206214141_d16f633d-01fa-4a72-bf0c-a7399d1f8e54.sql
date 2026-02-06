
-- Categories for proyecto_empresas status tracking
CREATE TABLE public.categorias_proyecto (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  orden integer NOT NULL DEFAULT 0,
  es_adjudicado boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.subcategorias_proyecto (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id uuid NOT NULL REFERENCES public.categorias_proyecto(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  orden integer NOT NULL DEFAULT 0,
  es_adjudicado boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_proyecto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategorias_proyecto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to categorias_proyecto" ON public.categorias_proyecto FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to subcategorias_proyecto" ON public.subcategorias_proyecto FOR ALL USING (true) WITH CHECK (true);

-- Add category reference to proyecto_empresas (nullable, replaces adjudicado boolean logic)
ALTER TABLE public.proyecto_empresas
  ADD COLUMN categoria_id uuid REFERENCES public.categorias_proyecto(id) ON DELETE SET NULL,
  ADD COLUMN subcategoria_id uuid REFERENCES public.subcategorias_proyecto(id) ON DELETE SET NULL;

-- Seed default categories
INSERT INTO public.categorias_proyecto (nombre, color, orden, es_adjudicado) VALUES
  ('Pendiente', '#6b7280', 1, false),
  ('Contactado', '#3b82f6', 2, false),
  ('Cotización en Curso', '#f59e0b', 3, false),
  ('Cotización Enviada', '#8b5cf6', 4, false),
  ('Negociación', '#ec4899', 5, false),
  ('Cerrado', '#10b981', 6, false);

-- Seed subcategories for "Cerrado"
INSERT INTO public.subcategorias_proyecto (categoria_id, nombre, color, orden, es_adjudicado)
SELECT id, 'Ganado', '#22c55e', 1, true FROM public.categorias_proyecto WHERE nombre = 'Cerrado'
UNION ALL
SELECT id, 'Perdido', '#ef4444', 2, false FROM public.categorias_proyecto WHERE nombre = 'Cerrado'
UNION ALL
SELECT id, 'Descartado', '#6b7280', 3, false FROM public.categorias_proyecto WHERE nombre = 'Cerrado'
UNION ALL
SELECT id, 'Atiende Directo', '#f97316', 4, false FROM public.categorias_proyecto WHERE nombre = 'Cerrado';
