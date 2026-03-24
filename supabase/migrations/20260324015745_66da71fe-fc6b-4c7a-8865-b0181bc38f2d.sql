
-- Add special attention notes field to empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS notas_atencion_especial TEXT NOT NULL DEFAULT '';

-- Create checklist items table for empresas
CREATE TABLE public.empresa_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  parent_id UUID REFERENCES public.empresa_checklist_items(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.empresa_checklist_items ENABLE ROW LEVEL SECURITY;

-- Permissive policies for authenticated users
CREATE POLICY "Authenticated can read empresa_checklist_items"
  ON public.empresa_checklist_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert empresa_checklist_items"
  ON public.empresa_checklist_items FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update empresa_checklist_items"
  ON public.empresa_checklist_items FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete empresa_checklist_items"
  ON public.empresa_checklist_items FOR DELETE TO authenticated
  USING (true);
