
-- Checklist mentions
CREATE TABLE public.checklist_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES public.empresa_checklist_items(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL,
  proyecto_id UUID,
  empresa_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (checklist_item_id, mentioned_user_id)
);
CREATE INDEX idx_checklist_mentions_user ON public.checklist_mentions(mentioned_user_id);
CREATE INDEX idx_checklist_mentions_item ON public.checklist_mentions(checklist_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_mentions TO authenticated;
GRANT ALL ON public.checklist_mentions TO service_role;
ALTER TABLE public.checklist_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own mentions or admin"
ON public.checklist_mentions FOR SELECT TO authenticated
USING (mentioned_user_id = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "insert mentions authenticated"
ON public.checklist_mentions FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "delete mentions by author or admin"
ON public.checklist_mentions FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Mention reads
CREATE TABLE public.checklist_mention_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id UUID NOT NULL REFERENCES public.checklist_mentions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mention_id, user_id)
);
CREATE INDEX idx_mention_reads_user ON public.checklist_mention_reads(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_mention_reads TO authenticated;
GRANT ALL ON public.checklist_mention_reads TO service_role;
ALTER TABLE public.checklist_mention_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage own reads" ON public.checklist_mention_reads
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Sync function: parses @tokens from text and reconciles mentions
CREATE OR REPLACE FUNCTION public.sync_checklist_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token TEXT;
  _user_id UUID;
  _new_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Extract tokens like @abc123 (letters, digits, accents, underscore)
  FOR _token IN
    SELECT DISTINCT lower(unaccent(m[1]))
    FROM regexp_matches(COALESCE(NEW.text, ''), '@([A-Za-zÀ-ÿ0-9_]+)', 'g') AS m
  LOOP
    SELECT user_id INTO _user_id
    FROM public.profiles
    WHERE lower(unaccent(replace(display_name, ' ', ''))) = _token
    LIMIT 1;

    IF _user_id IS NOT NULL THEN
      _new_ids := array_append(_new_ids, _user_id);
    END IF;
  END LOOP;

  -- Delete mentions no longer present
  DELETE FROM public.checklist_mentions
  WHERE checklist_item_id = NEW.id
    AND NOT (mentioned_user_id = ANY(_new_ids));

  -- Insert new mentions
  IF array_length(_new_ids, 1) IS NOT NULL THEN
    INSERT INTO public.checklist_mentions (checklist_item_id, mentioned_user_id, proyecto_id, empresa_id, created_by)
    SELECT NEW.id, uid, NEW.proyecto_id, NEW.empresa_id, NEW.created_by
    FROM unnest(_new_ids) AS uid
    ON CONFLICT (checklist_item_id, mentioned_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure unaccent extension available
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TRIGGER trg_sync_checklist_mentions_ins
AFTER INSERT ON public.empresa_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.sync_checklist_mentions();

CREATE TRIGGER trg_sync_checklist_mentions_upd
AFTER UPDATE OF text ON public.empresa_checklist_items
FOR EACH ROW
WHEN (OLD.text IS DISTINCT FROM NEW.text)
EXECUTE FUNCTION public.sync_checklist_mentions();
