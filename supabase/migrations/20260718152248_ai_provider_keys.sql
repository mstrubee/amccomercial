-- Stores third-party AI provider API keys (e.g. Gemini) configured by an admin.
-- Intentionally has NO RLS policies: with RLS enabled and zero policies, Postgres
-- denies all access to the anon/authenticated roles by default. Only Supabase
-- Edge Functions (using the service-role key, which bypasses RLS) can read or
-- write this table. The raw key must never be selectable directly from the
-- browser, even by an admin's session.
CREATE TABLE public.ai_provider_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text UNIQUE NOT NULL,
  api_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;
