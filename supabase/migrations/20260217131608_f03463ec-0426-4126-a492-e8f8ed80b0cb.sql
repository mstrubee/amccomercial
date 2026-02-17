
-- Allow usuario_tipo_1 to insert clientes
CREATE POLICY "usuario_tipo_1 can insert clientes"
ON public.clientes
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'usuario_tipo_1'::app_role));

-- Allow usuario_tipo_1 to update clientes
CREATE POLICY "usuario_tipo_1 can update clientes"
ON public.clientes
FOR UPDATE
USING (has_role(auth.uid(), 'usuario_tipo_1'::app_role));

-- Allow usuario_tipo_1 to insert contactos_cliente
CREATE POLICY "usuario_tipo_1 can insert contactos_cliente"
ON public.contactos_cliente
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'usuario_tipo_1'::app_role));

-- Allow usuario_tipo_1 to update contactos_cliente
CREATE POLICY "usuario_tipo_1 can update contactos_cliente"
ON public.contactos_cliente
FOR UPDATE
USING (has_role(auth.uid(), 'usuario_tipo_1'::app_role));

-- Allow usuario_tipo_1 to delete contactos_cliente (needed for re-sync on update)
CREATE POLICY "usuario_tipo_1 can delete contactos_cliente"
ON public.contactos_cliente
FOR DELETE
USING (has_role(auth.uid(), 'usuario_tipo_1'::app_role));
