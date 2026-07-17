-- Atomic replace of a cliente/captador plus its contactos, so a failed insert
-- after the delete can no longer wipe the contacts permanently (audit A1/A2).
-- These run with the default SECURITY INVOKER, so existing RLS policies on
-- clientes / captadores / contactos_* apply exactly as they do today — this
-- change adds transactional atomicity, not new privileges.

CREATE OR REPLACE FUNCTION public.update_cliente_full(
  p_id uuid,
  p_categoria_id uuid,
  p_nombre text,
  p_contactos jsonb
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.clientes
     SET categoria_id = p_categoria_id,
         nombre = p_nombre
   WHERE id = p_id;

  DELETE FROM public.contactos_cliente WHERE cliente_id = p_id;

  IF p_contactos IS NOT NULL AND jsonb_array_length(p_contactos) > 0 THEN
    INSERT INTO public.contactos_cliente (cliente_id, contacto, email, telefono, orden)
    SELECT p_id,
           COALESCE(elem->>'contacto', ''),
           COALESCE(elem->>'email', ''),
           COALESCE(elem->>'telefono', ''),
           (ord - 1)::int
      FROM jsonb_array_elements(p_contactos) WITH ORDINALITY AS t(elem, ord);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_captador_full(
  p_id uuid,
  p_categoria_id uuid,
  p_nombre text,
  p_contactos jsonb
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.captadores
     SET categoria_id = p_categoria_id,
         nombre = p_nombre
   WHERE id = p_id;

  DELETE FROM public.contactos_captador WHERE captador_id = p_id;

  IF p_contactos IS NOT NULL AND jsonb_array_length(p_contactos) > 0 THEN
    INSERT INTO public.contactos_captador (captador_id, contacto, email, telefono, orden)
    SELECT p_id,
           COALESCE(elem->>'contacto', ''),
           COALESCE(elem->>'email', ''),
           COALESCE(elem->>'telefono', ''),
           (ord - 1)::int
      FROM jsonb_array_elements(p_contactos) WITH ORDINALITY AS t(elem, ord);
  END IF;
END;
$$;
