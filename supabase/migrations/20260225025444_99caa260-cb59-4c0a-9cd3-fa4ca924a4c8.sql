
-- Create public storage bucket for company logo
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read, only admins can upload/delete/update
CREATE POLICY "Public read company-assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-assets');

CREATE POLICY "Admins can upload company-assets" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-assets' 
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins can delete company-assets" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'company-assets' 
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins can update company-assets" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'company-assets' 
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );
