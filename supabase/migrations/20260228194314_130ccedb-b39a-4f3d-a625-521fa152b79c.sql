
-- folder_templates (Repositorio Tipo)
CREATE TABLE public.folder_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.folder_templates(id) ON DELETE CASCADE,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.folder_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage folder_templates"
  ON public.folder_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read folder_templates"
  ON public.folder_templates FOR SELECT
  TO authenticated
  USING (true);

-- project_folders (Repositorios de Proyecto)
CREATE TABLE public.project_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.project_folders(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.folder_templates(id) ON DELETE SET NULL,
  drive_folder_id text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read project_folders"
  ON public.project_folders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and tipo1 can insert project_folders"
  ON public.project_folders FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'usuario_tipo_1'::app_role));

CREATE POLICY "Admins and tipo1 can update project_folders"
  ON public.project_folders FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'usuario_tipo_1'::app_role));

CREATE POLICY "Only admins can delete project_folders"
  ON public.project_folders FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
