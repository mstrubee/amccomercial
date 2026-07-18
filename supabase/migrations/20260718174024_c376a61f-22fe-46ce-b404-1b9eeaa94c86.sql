
-- 1. Add contacto_id column + FK to proyecto_clientes
ALTER TABLE public.proyecto_clientes
  ADD COLUMN IF NOT EXISTS contacto_id uuid NULL REFERENCES public.contactos_cliente(id) ON DELETE SET NULL;

-- 2. Relax INSERT/UPDATE policies so Captadores (and any authenticated user) can link clients to projects
DROP POLICY IF EXISTS "Admins and tipo1 can insert proyecto_clientes" ON public.proyecto_clientes;
DROP POLICY IF EXISTS "Admins and tipo1 can update proyecto_clientes" ON public.proyecto_clientes;

CREATE POLICY "Authenticated can insert proyecto_clientes"
  ON public.proyecto_clientes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update proyecto_clientes"
  ON public.proyecto_clientes FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
