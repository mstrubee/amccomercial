

## Personalización Avanzada en Ventana Flotante

### Resumen
Transformar la página de Personalización actual en un **diálogo flotante (Dialog)** accesible desde el menú de Administración, y agregar tres nuevas funcionalidades:
1. **Importar fuentes personalizadas** (Google Fonts por URL)
2. **Gestionar logo de la empresa** (subir, ver, editar, eliminar)
3. **Color de fondo del sistema** (no solo sidebar)
4. **Posición del widget flotante de alertas** (esquina configurable)

---

### Cambios planificados

#### 1. Convertir PersonalizacionPage a Dialog flotante

- Reemplazar la página `/personalizacion` con un **Dialog** que se abre desde el sidebar
- En `AppLayout.tsx`, el item "Personalización" en lugar de navegar a una ruta, abrirá el diálogo directamente
- Eliminar la ruta `/personalizacion` de `App.tsx`
- El diálogo usará tabs para organizar las secciones: Colores, Tipografía, Logo, Alertas

#### 2. Importar fuentes personalizadas

- Agregar un campo de texto donde el admin puede pegar una URL de Google Fonts (ej: `https://fonts.googleapis.com/css2?family=Nunito...`)
- Al guardar, se inyecta un `<link>` en el `<head>` del documento
- Se guarda en `app_settings` con key `theme_custom_font_url`
- El campo de fuente existente se mantiene pero se agregan las fuentes importadas como opciones adicionales
- Nuevo key en `app_settings`: `theme_custom_font_url`

#### 3. Logo de la empresa

- Crear un bucket de storage público llamado `company-assets` para almacenar el logo
- UI: mostrar el logo actual, botones para subir uno nuevo o eliminar
- Guardar la URL del logo en `app_settings` con key `theme_company_logo`
- Actualizar `AppLayout.tsx` y `Auth.tsx` para usar el logo personalizado (con fallback al logo AMC por defecto)

#### 4. Color de fondo del sistema

- Agregar un color picker para `theme_background_color`
- Aplicar como CSS variable `--custom-bg` en el hook `useThemeSettings`
- En `index.css`, el body usará `var(--custom-bg)` como override cuando esté definido

#### 5. Posición del widget de alertas

- Agregar un selector con 4 opciones: inferior-derecha (default), inferior-izquierda, superior-derecha, superior-izquierda
- Guardar en `app_settings` con key `theme_alert_position`
- El hook `useThemeSettings` expondrá este valor
- `AlertaWidget.tsx` leerá la posición y aplicará las clases CSS correspondientes

---

### Detalles técnicos

**Migración SQL:**
```sql
-- Create public storage bucket for company logo
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-assets', 'company-assets', true);

-- RLS: anyone can read, only admins can upload/delete
CREATE POLICY "Public read company-assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-assets');

CREATE POLICY "Admins can upload company-assets" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-assets' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete company-assets" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'company-assets' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can update company-assets" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'company-assets' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );
```

**Archivos a modificar:**

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useThemeSettings.ts` | Agregar keys: `theme_company_logo`, `theme_custom_font_url`, `theme_background_color`, `theme_alert_position`. Aplicar CSS variables correspondientes e inyectar link de fuente. |
| `src/pages/PersonalizacionPage.tsx` | Convertir a componente `PersonalizacionDialog` con tabs (Colores, Tipografía, Logo, Alertas). Agregar upload de logo, import de fuentes, color de fondo, y selector de posición de alertas. |
| `src/components/layout/AppLayout.tsx` | Cambiar el link de Personalización por un botón que abre el Dialog. Usar logo personalizado con fallback. Pasar `isAdmin` para controlar visibilidad del botón de personalización dentro del diálogo. |
| `src/App.tsx` | Eliminar ruta `/personalizacion`. |
| `src/components/alertas/AlertaWidget.tsx` | Leer `theme_alert_position` del hook y aplicar posición dinámica (bottom-right, bottom-left, top-right, top-left). |
| `src/pages/Auth.tsx` | Usar logo personalizado si existe (con fallback). |

**Nuevas keys en `app_settings`:**
- `theme_company_logo` - URL del logo subido
- `theme_custom_font_url` - URL de Google Fonts personalizada
- `theme_background_color` - Color de fondo del sistema
- `theme_alert_position` - Posición del widget: `bottom-right` | `bottom-left` | `top-right` | `top-left`

