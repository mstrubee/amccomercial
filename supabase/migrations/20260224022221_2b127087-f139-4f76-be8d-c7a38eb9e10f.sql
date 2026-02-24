
CREATE TABLE public.delegaciones_alerta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegante_id uuid NOT NULL,
  delegado_id uuid NOT NULL,
  otorgado_por uuid NOT NULL,
  fecha_inicio timestamptz NOT NULL DEFAULT now(),
  fecha_fin timestamptz NOT NULL,
  revocada boolean NOT NULL DEFAULT false,
  revocada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(delegante_id, delegado_id)
);

ALTER TABLE public.delegaciones_alerta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage delegaciones"
  ON public.delegaciones_alerta FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own delegaciones"
  ON public.delegaciones_alerta FOR SELECT
  USING (auth.uid() = delegado_id OR auth.uid() = delegante_id);
