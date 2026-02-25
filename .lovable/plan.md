

## Personalización Visual desde Administración

### Resumen
Agregar una nueva sección en el panel de Administración llamada **"Personalización"** donde el administrador pueda configurar:
1. **Color del navbar (sidebar)** - Color de fondo personalizado
2. **Tipografía de elementos seleccionados** - Familia de fuente para los items activos del menú y en general en el sistema

Los valores se guardarán en la tabla `app_settings` (ya existente) y se aplicarán dinámicamente como CSS custom properties en toda la aplicación.

### Detalles técnicos

**1. Nueva página: `src/pages/PersonalizacionPage.tsx`**

Formulario con:
- Un color picker para el color de fondo del sidebar (`sidebar_bg_color`)
- Un color picker para el color de texto del sidebar (`sidebar_text_color`) 
- Un color picker para el color de acento/items activos (`sidebar_accent_color`)
- Un selector de fuente (dropdown) con opciones: Inter (default), Roboto, Poppins, Montserrat, Open Sans, Lato
- Vista previa en vivo de los cambios antes de guardar
- Botón "Restaurar valores predeterminados"

Usa `app_settings` con keys: `theme_sidebar_bg`, `theme_sidebar_text`, `theme_accent_color`, `theme_font_family`

**2. Nuevo hook: `src/hooks/useThemeSettings.ts`**

- `useThemeSettings()` - query que lee las 4 keys de `app_settings` 
- `useSaveThemeSetting()` - mutation para upsert un key/value
- Al cargar, aplica las variables CSS dinámicamente en `document.documentElement.style`

**3. Modificar `src/components/layout/AppLayout.tsx`**

- Importar `useThemeSettings` y aplicar los estilos inline en el sidebar:
  - `backgroundColor` desde `theme_sidebar_bg`
  - `color` desde `theme_sidebar_text`
  - Acento desde `theme_accent_color`
- Aplicar la fuente globalmente via `document.documentElement.style.setProperty('--font-family', ...)`

**4. Modificar `src/App.tsx`**

- Importar `useThemeSettings` en `AppRoutes` para que los estilos se apliquen al cargar la app
- Agregar ruta `/personalizacion` para admins

**5. Modificar `src/components/layout/AppLayout.tsx` (navegación)**

- Agregar `{ path: "/personalizacion", label: "Personalización", allowTipo1: false }` a `allAdminSubItems`

**6. Modificar `src/index.css`**

- Agregar importaciones de Google Fonts para las familias adicionales (Roboto, Poppins, Montserrat, Open Sans, Lato)
- Usar `var(--custom-font, 'Inter')` en el body para que sea sobreescribible

**7. Migración SQL**

Insertar las filas iniciales en `app_settings` con valores por defecto (no se necesitan nuevas tablas ni políticas RLS ya que `app_settings` ya tiene las correctas para admins, y SELECT está permitido para todos los autenticados via la policy existente).

Nota: Actualmente `app_settings` no tiene policy de SELECT para autenticados. Se necesitará agregar una policy `SELECT` para `authenticated` para que todos los usuarios puedan leer la configuración del tema.

```sql
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
```
