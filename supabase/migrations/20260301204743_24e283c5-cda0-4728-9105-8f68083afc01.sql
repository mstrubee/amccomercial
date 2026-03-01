-- 1) Contexto por secciones/subsecciones en conversaciones
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS project_id uuid NULL,
ADD COLUMN IF NOT EXISTS empresa_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_project_id_fkey'
  ) THEN
    ALTER TABLE public.conversations
    ADD CONSTRAINT conversations_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.proyectos(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_empresa_id_fkey'
  ) THEN
    ALTER TABLE public.conversations
    ADD CONSTRAINT conversations_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON public.conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_empresa_id ON public.conversations(empresa_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

-- 2) Read receipts reales
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON public.messages(conversation_id, is_read);

-- 3) Preferencias de sonido por usuario
CREATE TABLE IF NOT EXISTS public.chat_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sound_option text NOT NULL DEFAULT 'pop',
  custom_sound_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_preferences_user_unique UNIQUE (user_id),
  CONSTRAINT chat_preferences_user_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  CONSTRAINT chat_preferences_sound_option_check CHECK (sound_option IN ('pop','icq','bell','ding','mute','custom'))
);

ALTER TABLE public.chat_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own chat preferences" ON public.chat_preferences;
CREATE POLICY "Users can read own chat preferences"
ON public.chat_preferences
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat preferences" ON public.chat_preferences;
CREATE POLICY "Users can insert own chat preferences"
ON public.chat_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chat preferences" ON public.chat_preferences;
CREATE POLICY "Users can update own chat preferences"
ON public.chat_preferences
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all chat preferences" ON public.chat_preferences;
CREATE POLICY "Admins can read all chat preferences"
ON public.chat_preferences
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete chat preferences" ON public.chat_preferences;
CREATE POLICY "Admins can delete chat preferences"
ON public.chat_preferences
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_chat_preferences_updated_at ON public.chat_preferences;
CREATE TRIGGER trg_chat_preferences_updated_at
BEFORE UPDATE ON public.chat_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Storage para sonidos personalizados
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-sounds', 'chat-sounds', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read chat sounds" ON storage.objects;
CREATE POLICY "Public read chat sounds"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-sounds');

DROP POLICY IF EXISTS "Users upload own chat sounds" ON storage.objects;
CREATE POLICY "Users upload own chat sounds"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'chat-sounds'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users update own chat sounds" ON storage.objects;
CREATE POLICY "Users update own chat sounds"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'chat-sounds'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'chat-sounds'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users delete own chat sounds" ON storage.objects;
CREATE POLICY "Users delete own chat sounds"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'chat-sounds'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5) Moderación / borrado admin + read receipts
DROP POLICY IF EXISTS "Participants can read conversations" ON public.conversations;
CREATE POLICY "Participants or admin can read conversations"
ON public.conversations
FOR SELECT
USING (
  public.is_conversation_participant(auth.uid(), id)
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants or admin can update conversations"
ON public.conversations
FOR UPDATE
USING (
  public.is_conversation_participant(auth.uid(), id)
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.is_conversation_participant(auth.uid(), id)
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins can delete conversations" ON public.conversations;
CREATE POLICY "Admins can delete conversations"
ON public.conversations
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Participants can read messages" ON public.messages;
CREATE POLICY "Participants or admin can read messages"
ON public.messages
FOR SELECT
USING (
  public.is_conversation_participant(auth.uid(), conversation_id)
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_conversation_participant(auth.uid(), conversation_id)
);

DROP POLICY IF EXISTS "Participants can mark read" ON public.messages;
CREATE POLICY "Participants can mark read"
ON public.messages
FOR UPDATE
USING (
  public.is_conversation_participant(auth.uid(), conversation_id)
)
WITH CHECK (
  public.is_conversation_participant(auth.uid(), conversation_id)
);

DROP POLICY IF EXISTS "Admins can delete messages" ON public.messages;
CREATE POLICY "Admins can delete messages"
ON public.messages
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete conversation participants" ON public.conversation_participants;
CREATE POLICY "Admins can delete conversation participants"
ON public.conversation_participants
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can read participants" ON public.conversation_participants;
CREATE POLICY "Admins can read participants"
ON public.conversation_participants
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update participants" ON public.conversation_participants;
CREATE POLICY "Admins can update participants"
ON public.conversation_participants
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert participants" ON public.conversation_participants;
CREATE POLICY "Admins can insert participants"
ON public.conversation_participants
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));