
-- Create storage bucket for bulk upload files
INSERT INTO storage.buckets (id, name, public)
VALUES ('carga-masiva-archivos', 'carga-masiva-archivos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "Authenticated users can upload bulk files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'carga-masiva-archivos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read bulk files"
ON storage.objects FOR SELECT
USING (bucket_id = 'carga-masiva-archivos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete bulk files"
ON storage.objects FOR DELETE
USING (bucket_id = 'carga-masiva-archivos' AND auth.role() = 'authenticated');
