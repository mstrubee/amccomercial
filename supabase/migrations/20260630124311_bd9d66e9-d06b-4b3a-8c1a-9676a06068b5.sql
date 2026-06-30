
-- Replace open SELECT policy on drive-upload-queue with owner-scoped one
DROP POLICY IF EXISTS "Auth users can read own uploads" ON storage.objects;
CREATE POLICY "Auth users can read own uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'drive-upload-queue'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Tighten admin policy on user_permissions to authenticated role
DROP POLICY IF EXISTS "Admins can manage user_permissions" ON public.user_permissions;
CREATE POLICY "Admins can manage user_permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
