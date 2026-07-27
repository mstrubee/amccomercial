-- Storage: scope carga-masiva buckets to uploader or admin
DROP POLICY IF EXISTS "Authenticated users can read sample files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete sample files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload sample files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read bulk files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete bulk files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload bulk files" ON storage.objects;

CREATE POLICY "Owners or admins read bulk upload files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('carga-masiva-archivos','carga-masiva-muestras')
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Users upload their own bulk upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('carga-masiva-archivos','carga-masiva-muestras')
  AND owner = auth.uid()
);

CREATE POLICY "Owners or admins update bulk upload files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('carga-masiva-archivos','carga-masiva-muestras')
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
)
WITH CHECK (
  bucket_id IN ('carga-masiva-archivos','carga-masiva-muestras')
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Owners or admins delete bulk upload files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('carga-masiva-archivos','carga-masiva-muestras')
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

-- Realtime: remove unscoped subscribe-to-anything policy
DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON realtime.messages;