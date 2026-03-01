

# Sistema de Mensajeria In-App

## Resumen
Crear un sistema de chat interno entre usuarios de la plataforma, accesible desde un boton flotante (similar al de presencia) y tambien desde una pagina dedicada.

## Estructura de la base de datos

### Tabla `conversations`
- `id` (uuid, PK)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### Tabla `conversation_participants`
- `id` (uuid, PK)
- `conversation_id` (uuid, FK -> conversations)
- `user_id` (uuid, FK -> auth.users)
- `joined_at` (timestamptz)
- `last_read_at` (timestamptz) -- para marcar mensajes leidos

### Tabla `messages`
- `id` (uuid, PK)
- `conversation_id` (uuid, FK -> conversations)
- `sender_id` (uuid, FK -> auth.users)
- `content` (text)
- `created_at` (timestamptz)

Todas con RLS: los participantes solo pueden leer/escribir en sus propias conversaciones. Se habilitara Realtime en `messages` para actualizaciones instantaneas.

## Componentes del frontend

1. **Boton flotante de mensajeria** (`FloatingChat.tsx`)
   - Icono de mensaje en la esquina inferior derecha (junto al boton de presencia existente)
   - Badge con contador de mensajes no leidos
   - Al hacer clic, abre un panel con la lista de conversaciones

2. **Panel de conversaciones** (dentro del flotante)
   - Lista de conversaciones con ultimo mensaje y nombre del otro usuario
   - Boton "Nueva conversacion" que muestra selector de usuarios (desde `profiles`)
   - Indicador de mensajes no leidos por conversacion

3. **Vista de chat**
   - Muestra los mensajes de la conversacion seleccionada
   - Campo de texto para enviar mensajes
   - Scroll automatico al ultimo mensaje
   - Actualizacion en tiempo real via Realtime

4. **Hook `useMessages.ts`**
   - Queries para conversaciones, participantes, mensajes
   - Suscripcion Realtime para mensajes nuevos
   - Mutaciones para enviar mensajes, crear conversaciones, marcar como leido

## Flujo del usuario
1. Hace clic en el icono de chat flotante
2. Ve sus conversaciones existentes o inicia una nueva seleccionando un usuario
3. Escribe y envia mensajes que aparecen en tiempo real para ambos participantes
4. El badge muestra mensajes sin leer incluso con el panel cerrado

## Detalles tecnicos

- **Realtime**: Se usara `postgres_changes` en la tabla `messages` para recibir mensajes nuevos al instante
- **Mensajes no leidos**: Se calcula comparando `last_read_at` del participante con `created_at` de los mensajes
- **Seguridad RLS**: Los usuarios solo ven conversaciones donde son participantes, usando una funcion `SECURITY DEFINER` para evitar recursion
- **Posicionamiento**: El boton flotante se ubicara en `bottom-[52px] right-4` para no chocar con el boton de presencia existente (que esta en `left-4`)

