-- User permissions table for visibility and access control
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  -- Which empresas the user can see (null = all)
  empresas_visibles uuid[] DEFAULT NULL,
  -- Which menu sections the user can access (null = all)
  secciones_visibles text[] DEFAULT NULL,
  -- Which dashboard widgets the user can see (null = all)
  dashboard_widgets text[] DEFAULT NULL,
  -- Whether the user can edit data or is read-only
  puede_editar boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage user_permissions"
  ON public.user_permissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can read their own permissions
CREATE POLICY "Users can read own permissions"
  ON public.user_permissions FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
