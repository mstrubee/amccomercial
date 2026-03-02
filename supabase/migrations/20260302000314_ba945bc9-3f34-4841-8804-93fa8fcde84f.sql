
CREATE TABLE public.user_google_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  refresh_token text NOT NULL,
  access_token text,
  expires_at timestamptz,
  scopes text DEFAULT 'calendar',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own google tokens"
  ON public.user_google_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own google tokens"
  ON public.user_google_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own google tokens"
  ON public.user_google_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own google tokens"
  ON public.user_google_tokens FOR DELETE
  USING (auth.uid() = user_id);
