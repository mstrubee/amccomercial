
-- Add presence columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS activity_status text,
  ADD COLUMN IF NOT EXISTS current_section text;

-- Enable realtime for profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
