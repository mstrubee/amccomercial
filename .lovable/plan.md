

# Sincronizacion Bidireccional Resiliente con Google Drive

## Resumen

Implementar un sistema robusto de sincronizacion de archivos entre el sistema AMC y Google Drive, con estrategia offline-first, cola de subida, visualizacion de archivos via metadata, y borrado sincronizado.

---

## 1. Cambios en Base de Datos

### Tabla `pending_sync` (cola de subida)
Registra archivos pendientes de sincronizar con Drive.

```text
pending_sync
- id (uuid, PK)
- project_folder_id (uuid, FK -> project_folders)
- drive_folder_id (text, nullable)
- file_name (text)
- file_size (bigint)
- mime_type (text)
- storage_path (text)        -- ruta en bucket Supabase
- status (text)               -- 'pending' | 'uploading' | 'synced' | 'failed'
- error_message (text, nullable)
- retry_count (int, default 0)
- created_by (uuid)
- created_at (timestamptz)
- synced_at (timestamptz, nullable)
- drive_file_id (text, nullable)
```

### Tabla `drive_files` (metadata de archivos en Drive)
Cache de metadata para listar archivos sin consultar la API de Google.

```text
drive_files
- id (uuid, PK)
- project_folder_id (uuid, FK -> project_folders)
- drive_file_id (text)        -- ID del archivo en Google Drive
- drive_folder_id (text)
- file_name (text)
- mime_type (text)
- file_size (bigint)
- created_by (uuid)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### Bucket de Supabase Storage
Crear bucket privado `drive-upload-queue` para almacenar archivos temporalmente mientras se sincronizan.

### Politicas RLS
- Lectura de `drive_files` y `pending_sync`: usuarios autenticados
- Insercion: admin y usuario_tipo_1
- Eliminacion de `drive_files`: admin y usuario_tipo_1
- Eliminacion de `pending_sync`: solo admin

---

## 2. Edge Functions

### A. Modificar `upload-to-drive` (estrategia offline-first)

Flujo actualizado:
1. Recibir archivo via FormData
2. Guardar archivo en bucket `drive-upload-queue`
3. Registrar en tabla `pending_sync` con status `pending`
4. Intentar subir a Google Drive inmediatamente
5. Si exito: guardar `drive_file_id` en `drive_files`, marcar como `synced` en `pending_sync`, eliminar del bucket
6. Si fallo (API Google caida, error de red): dejar en bucket con status `pending` para reintento posterior

### B. Crear `process-sync-queue` (procesador de cola)

Edge function que:
1. Lee registros de `pending_sync` con status `pending` o `failed` (con retry_count < 5)
2. Para cada uno, descarga el archivo del bucket y lo sube a Drive
3. Si exito: actualiza `drive_files`, marca `synced`, elimina del bucket
4. Si fallo: incrementa `retry_count`, guarda `error_message`

Se ejecutara via cron job cada 2 minutos.

### C. Crear `delete-drive-file`

Edge function que:
1. Recibe `drive_file_id` y `drive_files_id` (registro en DB)
2. Llama a `DELETE` en Google Drive API
3. Elimina el registro de `drive_files`

### D. Modificar `sync-drive` (borrado de carpetas)

Agregar soporte para cuando se elimina una carpeta del sistema:
1. Recibir action `delete_folder` con `drive_folder_id`
2. Llamar a `DELETE` en Google Drive API para eliminar la carpeta (y todo su contenido)
3. Limpiar registros de `drive_files` asociados

### E. Crear `get-drive-view-url`

Edge function que:
1. Recibe `drive_file_id`
2. Usa la API de Google Drive para obtener `webContentLink` o `webViewLink`
3. Retorna la URL temporal para que el navegador del usuario acceda directamente a Google

---

## 3. Cambios en Frontend

### A. Hook `useDriveSync.ts` - Nuevas funciones

- `useUploadToDrive`: Modificar para guardar primero en bucket y luego intentar sync
- `useDriveFiles(folderId)`: Query que lee de tabla `drive_files` para listar archivos
- `useDeleteDriveFile()`: Mutation que llama a `delete-drive-file`
- `useGetDriveViewUrl()`: Mutation que obtiene URL de visualizacion directa
- `usePendingSyncCount()`: Query para mostrar indicador de archivos pendientes

### B. Hook `useProjectFolders.ts` - Borrado sincronizado

Modificar `useDeleteProjectFolder` para que, si la carpeta tiene `drive_folder_id`, tambien llame a `sync-drive` con action `delete_folder`.

### C. Componente `FolderTreeNode.tsx`

- Mostrar lista de archivos debajo de cada carpeta (usando `drive_files` de la DB)
- Cada archivo muestra: nombre, tamano, icono segun tipo
- Click en archivo: llama a `get-drive-view-url` y abre en nueva pestana
- Boton de eliminar archivo: llama a `delete-drive-file`
- Indicador visual de archivos pendientes de sync (icono de reloj o spinner)

### D. Componente `ProyectoRepositorioDialog.tsx`

- Mostrar badge/indicador de "X archivos pendientes de sincronizar"
- Detectar reconexion online con `navigator.onLine` + evento `online` para disparar `process-sync-queue`

### E. Detector de reconexion (en ProyectoRepositorioDialog o a nivel App)

- Listener de evento `online` del navegador
- Al detectar reconexion, llamar a `process-sync-queue` para procesar la cola

---

## 4. Cron Job para Cola de Sincronizacion

Configurar via `pg_cron` + `pg_net` un job que ejecute `process-sync-queue` cada 2 minutos para procesar archivos pendientes automaticamente, independientemente de si el usuario tiene la app abierta.

---

## 5. Seguridad

- Refresh token de Google se maneja via `app_settings` (ya implementado) con renovacion automatica en cada Edge Function
- Archivos en bucket `drive-upload-queue` son privados, accesibles solo via service role
- RLS en todas las tablas nuevas
- Edge functions validan JWT del usuario

---

## Secuencia de Implementacion

1. Crear tablas `pending_sync` y `drive_files` + bucket + RLS
2. Crear/modificar Edge Functions (upload-to-drive, process-sync-queue, delete-drive-file, get-drive-view-url, sync-drive)
3. Actualizar hooks frontend (useDriveSync, useProjectFolders)
4. Actualizar UI (FolderTreeNode con lista de archivos, preview, delete)
5. Configurar cron job
6. Agregar detector de reconexion online

