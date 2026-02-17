
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_name text DEFAULT '',
  details text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read activity_log"
  ON public.activity_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own activity"
  ON public.activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete activity_log"
  ON public.activity_log FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage app_settings"
  ON public.app_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (key, value) VALUES ('activity_log_retention_days', '90');

CREATE INDEX idx_activity_log_user_id ON public.activity_log (user_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log (created_at);
