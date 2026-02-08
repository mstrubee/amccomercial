
-- 1. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. User roles
CREATE TYPE public.app_role AS ENUM ('admin', 'usuario_tipo_1', 'usuario_tipo_2');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Anyone authenticated can read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Clasificaciones de proyecto (tipo de obra)
CREATE TABLE public.clasificaciones_proyecto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clasificaciones_proyecto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read clasificaciones" ON public.clasificaciones_proyecto FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage clasificaciones" ON public.clasificaciones_proyecto FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default clasificaciones
INSERT INTO public.clasificaciones_proyecto (nombre, orden) VALUES
  ('Casa', 1),
  ('Edificio Habitacional', 2),
  ('Condominio', 3),
  ('Institucional', 4),
  ('Oficina', 5);

-- 4. Add fecha_ingreso and clasificacion_id to proyectos
ALTER TABLE public.proyectos 
  ADD COLUMN fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN clasificacion_id UUID REFERENCES public.clasificaciones_proyecto(id) ON DELETE SET NULL;

-- 5. Update empresas RLS to restrict create/edit/delete to admin
DROP POLICY IF EXISTS "Allow all access to empresas" ON public.empresas;
CREATE POLICY "All authenticated can read empresas" ON public.empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can insert empresas" ON public.empresas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can update empresas" ON public.empresas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can delete empresas" ON public.empresas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. Update other tables to require authentication
DROP POLICY IF EXISTS "Allow all access to proyectos" ON public.proyectos;
CREATE POLICY "Authenticated can access proyectos" ON public.proyectos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to proyecto_empresas" ON public.proyecto_empresas;
CREATE POLICY "Authenticated can access proyecto_empresas" ON public.proyecto_empresas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to condiciones_comerciales" ON public.condiciones_comerciales;
CREATE POLICY "Authenticated can read condiciones" ON public.condiciones_comerciales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage condiciones" ON public.condiciones_comerciales FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can update condiciones" ON public.condiciones_comerciales FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can delete condiciones" ON public.condiciones_comerciales FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Allow all access to categorias_proyecto" ON public.categorias_proyecto;
CREATE POLICY "Authenticated can read categorias" ON public.categorias_proyecto FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categorias" ON public.categorias_proyecto FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Allow all access to subcategorias_proyecto" ON public.subcategorias_proyecto;
CREATE POLICY "Authenticated can read subcategorias" ON public.subcategorias_proyecto FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage subcategorias" ON public.subcategorias_proyecto FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
