
-- Add read policy for all authenticated users
CREATE POLICY "Authenticated can read app_settings" 
  ON public.app_settings FOR SELECT 
  TO authenticated 
  USING (true);

-- Insert default theme values
INSERT INTO public.app_settings (key, value) VALUES
  ('theme_sidebar_bg', ''),
  ('theme_sidebar_text', ''),
  ('theme_accent_color', ''),
  ('theme_font_family', 'Inter')
ON CONFLICT DO NOTHING;
