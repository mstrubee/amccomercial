
-- Add cotización (monto in UF) and adjudicado flag per empresa in proyecto_empresas
ALTER TABLE public.proyecto_empresas
  ADD COLUMN monto_cotizacion numeric DEFAULT 0,
  ADD COLUMN adjudicado boolean NOT NULL DEFAULT false;
