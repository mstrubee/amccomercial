
DROP POLICY "Only admins can delete project_folders" ON public.project_folders;

CREATE POLICY "Admins and tipo1 can delete project_folders"
ON public.project_folders
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'usuario_tipo_1'::app_role)
);
