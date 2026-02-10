
-- Create storage bucket for sample files
INSERT INTO storage.buckets (id, name, public) VALUES ('carga-masiva-muestras', 'carga-masiva-muestras', true);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload sample files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'carga-masiva-muestras' AND auth.role() = 'authenticated');

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read sample files"
ON storage.objects FOR SELECT
USING (bucket_id = 'carga-masiva-muestras' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete sample files"
ON storage.objects FOR DELETE
USING (bucket_id = 'carga-masiva-muestras' AND auth.role() = 'authenticated');
