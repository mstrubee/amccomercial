DROP POLICY IF EXISTS "Auth users can upload to drive-upload-queue" ON storage.objects;
CREATE POLICY "Auth users can upload to drive-upload-queue"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'drive-upload-queue'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);