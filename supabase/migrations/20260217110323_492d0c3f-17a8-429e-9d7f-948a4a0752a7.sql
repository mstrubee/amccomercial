
-- Create contactos_cliente table for multiple contacts per client
CREATE TABLE public.contactos_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  contacto text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contactos_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contactos_cliente"
  ON public.contactos_cliente FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read contactos_cliente"
  ON public.contactos_cliente FOR SELECT
  USING (true);

-- Migrate existing contact data into contactos_cliente
-- For each client row, create a contacto entry (only if there's actual data)
INSERT INTO public.contactos_cliente (cliente_id, contacto, email, telefono, orden)
SELECT id, contacto, email, telefono, 0
FROM public.clientes
WHERE contacto != '' OR email != '' OR telefono != '';

-- Now merge duplicates: keep the lowest-id client per (nombre, categoria_id),
-- re-parent contactos to the survivor, delete the rest

-- Step 1: Re-parent contactos from duplicate clients to the survivor
WITH survivors AS (
  SELECT DISTINCT ON (nombre, categoria_id) id AS survivor_id, nombre, categoria_id
  FROM public.clientes
  ORDER BY nombre, categoria_id, created_at ASC
),
duplicates AS (
  SELECT c.id AS dup_id, s.survivor_id
  FROM public.clientes c
  JOIN survivors s ON c.nombre = s.nombre AND c.categoria_id = s.categoria_id
  WHERE c.id != s.survivor_id
)
UPDATE public.contactos_cliente cc
SET cliente_id = d.survivor_id
FROM duplicates d
WHERE cc.cliente_id = d.dup_id;

-- Step 2: Delete duplicate client rows
WITH survivors AS (
  SELECT DISTINCT ON (nombre, categoria_id) id AS survivor_id, nombre, categoria_id
  FROM public.clientes
  ORDER BY nombre, categoria_id, created_at ASC
)
DELETE FROM public.clientes c
WHERE NOT EXISTS (
  SELECT 1 FROM survivors s WHERE s.survivor_id = c.id
);

-- Step 3: Renumber orden for contactos per client
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY cliente_id ORDER BY created_at) - 1 AS new_orden
  FROM public.contactos_cliente
)
UPDATE public.contactos_cliente cc
SET orden = n.new_orden
FROM numbered n
WHERE cc.id = n.id;

-- Remove empty contactos (no data at all)
DELETE FROM public.contactos_cliente
WHERE contacto = '' AND email = '' AND telefono = '';
