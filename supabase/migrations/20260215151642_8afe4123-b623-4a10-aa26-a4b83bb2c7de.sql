-- Make storage bucket private
UPDATE storage.buckets SET public = false WHERE id = 'carga-masiva-muestras';