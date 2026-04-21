ALTER TABLE public.historial_estatus_empresa REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.historial_estatus_empresa;