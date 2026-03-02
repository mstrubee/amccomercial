

# Integracion de Google Calendar - Todos los Usuarios

## Resumen
Cada usuario autenticado podra conectar su propia cuenta de Google Calendar desde una nueva pagina "/calendario". El calendario sera privado: cada usuario solo ve sus propios eventos. Se implementara vista mensual completa con lectura y escritura (crear, editar, eliminar eventos).

## Cambios principales

### 1. Base de datos: tabla `user_google_tokens`
Nueva tabla para almacenar tokens OAuth individuales por usuario, con RLS que garantiza que cada usuario solo acceda a su propio registro.

```text
user_google_tokens
- id (uuid, PK)
- user_id (uuid, NOT NULL, UNIQUE)
- refresh_token (text, NOT NULL)
- access_token (text)
- expires_at (timestamptz)
- scopes (text) -- para distinguir Drive vs Calendar
- created_at / updated_at (timestamptz)
```

RLS: solo `auth.uid() = user_id` para todas las operaciones.

### 2. Edge Function: `google-calendar-auth`
Maneja el flujo OAuth individual para Calendar:
- **POST action=get_auth_url**: genera URL con scope `https://www.googleapis.com/auth/calendar` y pasa el `user_id` en el parametro `state` de OAuth
- **GET callback**: intercambia el code por tokens y los guarda en `user_google_tokens` asociados al user_id extraido del state
- **POST action=check_status**: verifica si el usuario tiene token guardado
- **POST action=disconnect**: elimina el token del usuario

Reutiliza los secrets existentes `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.

### 3. Edge Function: `google-calendar-api`
Proxy autenticado para operaciones con Google Calendar API:
- **list_events**: lista eventos en rango de fechas del usuario autenticado
- **create_event**: crea evento nuevo
- **update_event**: actualiza evento existente
- **delete_event**: elimina evento
- Refresca automaticamente el access_token usando el refresh_token cuando expire

### 4. Frontend: pagina `/calendario`
- Grilla mensual interactiva mostrando eventos por dia
- Si el usuario no ha conectado Google Calendar, muestra boton para conectar
- Click en dia vacio para crear evento (dialog con titulo, fecha/hora inicio/fin, descripcion)
- Click en evento para ver detalles, editar o eliminar
- Navegacion entre meses con flechas
- Boton para desconectar Google Calendar

### 5. Navegacion
- Agregar "Calendario" como item del menu lateral principal (no dentro de Administracion), visible para todos los roles
- Icono: CalendarDays de lucide-react
- Ruta `/calendario` accesible para todos los usuarios autenticados

## Seccion tecnica

### Archivos nuevos
- `supabase/functions/google-calendar-auth/index.ts` -- OAuth flow por usuario
- `supabase/functions/google-calendar-api/index.ts` -- proxy a Google Calendar API
- `src/pages/Calendario.tsx` -- pagina principal con grilla mensual
- `src/components/calendario/CalendarGrid.tsx` -- componente de grilla mensual
- `src/components/calendario/CalendarEventDialog.tsx` -- dialog para crear/editar eventos
- `src/hooks/useGoogleCalendar.ts` -- hook con React Query para estado y operaciones

### Archivos modificados
- `src/components/layout/AppLayout.tsx` -- agregar enlace "Calendario" en navItems
- `src/App.tsx` -- agregar ruta /calendario

### Configuracion
- Registrar las dos nuevas funciones en `supabase/config.toml` con `verify_jwt = false`
- Migracion SQL para crear tabla `user_google_tokens`

### Flujo OAuth
A diferencia de la integracion de Drive (token compartido en app_settings), aqui cada usuario tiene su propio token. El redirect URI sera la edge function `google-calendar-auth`. Se codifica el `user_id` en el parametro `state` de OAuth para asociar el token al usuario correcto tras el callback. Se usa service_role_key en el callback para insertar/actualizar el token en la tabla.

### Seguridad
- Tokens almacenados con RLS estricto (solo el propio usuario)
- Edge functions validan JWT del usuario antes de operar
- El callback usa service_role para escribir tokens (ya que no hay sesion de usuario en el redirect de Google)
- Scope limitado a `https://www.googleapis.com/auth/calendar`

