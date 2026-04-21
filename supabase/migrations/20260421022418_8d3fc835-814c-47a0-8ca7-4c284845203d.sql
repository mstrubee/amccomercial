DO $$
DECLARE
  c_name text;
BEGIN
  -- Drop any existing CHECK constraints on hitos_template_columns that mention 'tipo'
  FOR c_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE ns.nspname = 'public'
      AND cls.relname = 'hitos_template_columns'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%tipo%'
  LOOP
    EXECUTE format('ALTER TABLE public.hitos_template_columns DROP CONSTRAINT %I', c_name);
  END LOOP;

  -- Drop any existing CHECK constraints on checkbox_action
  FOR c_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE ns.nspname = 'public'
      AND cls.relname = 'hitos_template_columns'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%checkbox_action%'
  LOOP
    EXECUTE format('ALTER TABLE public.hitos_template_columns DROP CONSTRAINT %I', c_name);
  END LOOP;
END $$;

ALTER TABLE public.hitos_template_columns
  ADD CONSTRAINT hitos_template_columns_tipo_check
  CHECK (tipo IN ('texto', 'select', 'fecha', 'checkbox'));

ALTER TABLE public.hitos_template_columns
  ADD CONSTRAINT hitos_template_columns_checkbox_action_check
  CHECK (checkbox_action IN ('fijar_fecha_y_completar', 'solo_fecha', 'solo_completar'));