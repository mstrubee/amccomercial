
ALTER TABLE public.categorias_proyecto
  ADD COLUMN boton_label text DEFAULT NULL,
  ADD COLUMN boton_bg_color text DEFAULT NULL,
  ADD COLUMN boton_text_color text DEFAULT NULL;

ALTER TABLE public.subcategorias_proyecto
  ADD COLUMN boton_label text DEFAULT NULL,
  ADD COLUMN boton_bg_color text DEFAULT NULL,
  ADD COLUMN boton_text_color text DEFAULT NULL;
