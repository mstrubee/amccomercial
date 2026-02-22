
ALTER TABLE public.proyecto_empresas
  ADD COLUMN ganado_presupuesto numeric DEFAULT NULL,
  ADD COLUMN ganado_op text DEFAULT NULL,
  ADD COLUMN ganado_fecha date DEFAULT NULL;
