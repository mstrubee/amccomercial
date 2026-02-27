
CREATE TABLE public.user_activity_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  idle_minutes integer NOT NULL DEFAULT 5,
  offline_minutes integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activity_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage thresholds"
  ON public.user_activity_thresholds FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read thresholds"
  ON public.user_activity_thresholds FOR SELECT
  TO authenticated
  USING (true);
