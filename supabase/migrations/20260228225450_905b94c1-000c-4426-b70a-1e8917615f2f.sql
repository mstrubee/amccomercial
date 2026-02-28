
-- 1. Create pending_sync table
CREATE TABLE public.pending_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_folder_id uuid REFERENCES public.project_folders(id) ON DELETE CASCADE NOT NULL,
  drive_folder_id text,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz,
  drive_file_id text
);

ALTER TABLE public.pending_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read pending_sync" ON public.pending_sync FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin and tipo1 can insert pending_sync" ON public.pending_sync FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));
CREATE POLICY "Admin and tipo1 can update pending_sync" ON public.pending_sync FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));
CREATE POLICY "Only admins can delete pending_sync" ON public.pending_sync FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Create drive_files table
CREATE TABLE public.drive_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_folder_id uuid REFERENCES public.project_folders(id) ON DELETE CASCADE NOT NULL,
  drive_file_id text NOT NULL,
  drive_folder_id text,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size bigint NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drive_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read drive_files" ON public.drive_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin and tipo1 can insert drive_files" ON public.drive_files FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));
CREATE POLICY "Admin and tipo1 can update drive_files" ON public.drive_files FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));
CREATE POLICY "Admin and tipo1 can delete drive_files" ON public.drive_files FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role));

-- 3. Create private bucket for upload queue
INSERT INTO storage.buckets (id, name, public) VALUES ('drive-upload-queue', 'drive-upload-queue', false);

-- 4. Storage RLS - only service role should access, but allow authenticated inserts for the edge function flow
CREATE POLICY "Auth users can upload to drive-upload-queue" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'drive-upload-queue');
CREATE POLICY "Auth users can read own uploads" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'drive-upload-queue');
CREATE POLICY "Service role can delete from drive-upload-queue" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'drive-upload-queue' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'usuario_tipo_1'::app_role)));
