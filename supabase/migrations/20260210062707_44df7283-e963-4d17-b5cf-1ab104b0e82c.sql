
-- Categories for clients (Arquitectura, Constructora, ITO, Dueños)
CREATE TABLE public.categorias_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read categorias_cliente"
  ON public.categorias_cliente FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage categorias_cliente"
  ON public.categorias_cliente FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Clients table
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES public.categorias_cliente(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  contacto text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read clientes"
  ON public.clientes FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage clientes"
  ON public.clientes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default categories
INSERT INTO public.categorias_cliente (nombre, orden) VALUES
  ('Arquitectura', 1),
  ('Constructora', 2),
  ('ITO', 3),
  ('Dueños', 4);
