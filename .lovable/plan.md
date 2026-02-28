

# Dos Mejoras al Repositorio de Proyectos

## Funcionalidad 1: Boton "Mostrar en Google Drive"

Agregar un boton en el dialogo del repositorio que abra directamente la carpeta del proyecto en Google Drive en una nueva pestana.

### Cambios
- **`ProyectoRepositorioDialog.tsx`**: Agregar boton "Ver en Google Drive" en la barra de acciones (junto a "Nueva Carpeta Raiz"). Al hacer clic, abre `https://drive.google.com/drive/folders/{drive_folder_id}` en nueva pestana. Solo visible cuando Drive esta conectado y el proyecto tiene carpetas sincronizadas.
- Para obtener el `drive_folder_id` de la carpeta raiz del proyecto en Drive, se usara la informacion que ya devuelve `sync-drive` (la carpeta `AMC Repositorio / [Proyecto]`). Se agregara un nuevo hook o se reutilizara la logica existente para guardar ese ID.

### Enfoque tecnico
- Agregar una nueva accion `get_project_drive_url` en `sync-drive` que busque la carpeta `AMC Repositorio / [Nombre Proyecto]` y devuelva su ID.
- Alternativamente (mas simple): durante el sync actual, guardar el `drive_folder_id` del proyecto raiz en `app_settings` o en la propia tabla `project_folders` como carpeta con `parent_id = null`. Ya que las carpetas raiz del proyecto en `project_folders` tienen `parent_id = null`, se puede buscar la primera carpeta raiz con `drive_folder_id` para construir la URL del padre (la carpeta del proyecto en Drive).
- Enfoque mas directo: agregar accion `get_project_folder` al edge function que devuelva el ID de la carpeta del proyecto en Drive, o simplemente construir la URL desde el frontend usando la logica de `findOrCreateFolder`.

**Solucion elegida**: Usar la carpeta raiz del proyecto en Drive. Durante el sync, ya se crea `AMC Repositorio / [Proyecto]`. Se agregara una columna o se buscara por nombre. Lo mas simple: agregar una consulta rapida al edge function `sync-drive` con action `get_project_drive_id` que retorne el ID de la carpeta del proyecto en Drive.

---

## Funcionalidad 2: Sincronizacion Bidireccional (Drive hacia Sistema)

Cuando se agregan o eliminan archivos/carpetas directamente en Google Drive, estos cambios deben reflejarse en el sistema al abrir el repositorio o sincronizar.

### Cambios en Backend

**`sync-drive/index.ts`** - Agregar accion `reverse_sync`:

1. **Importar carpetas de Drive al sistema**:
   - Para cada carpeta del proyecto en `project_folders` que tenga `drive_folder_id`, listar las subcarpetas en Drive usando la API (`files.list` con `mimeType=folder` y `parents`).
   - Comparar con las carpetas en `project_folders`:
     - Si una carpeta existe en Drive pero NO en `project_folders`, crearla en la DB.
     - Si una carpeta existe en `project_folders` pero su `drive_folder_id` ya no existe en Drive (fue eliminada), eliminarla de la DB.

2. **Importar archivos de Drive al sistema**:
   - Para cada carpeta del proyecto, listar archivos (no carpetas) en Drive.
   - Comparar con `drive_files`:
     - Si un archivo existe en Drive pero NO en `drive_files`, insertarlo en la tabla `drive_files`.
     - Si un archivo existe en `drive_files` pero ya no existe en Drive, eliminarlo de la DB.

3. **Orden de ejecucion**:
   - Primero ejecutar el sync normal (sistema hacia Drive).
   - Luego ejecutar el reverse sync (Drive hacia sistema).

### Cambios en Frontend

**`ProyectoRepositorioDialog.tsx`**:
- Despues del sync normal, llamar automaticamente al reverse sync.
- El boton de sincronizacion manual (si se agrega) tambien disparara ambos sentidos.

**`useDriveSync.ts`**:
- Modificar `useSyncDrive` para que el sync incluya la fase inversa automaticamente (o como paso adicional despues del sync principal).

### Detalle tecnico del reverse sync

```text
Para cada project_folder con drive_folder_id:
  1. GET Drive API: listar hijos del drive_folder_id
     - Separar en carpetas y archivos
  
  2. CARPETAS encontradas en Drive:
     - Si drive_folder_id no existe en project_folders -> INSERT en project_folders
     - Recursion: procesar subcarpetas de la nueva carpeta
  
  3. ARCHIVOS encontrados en Drive:
     - Si drive_file_id no existe en drive_files -> INSERT en drive_files
  
  4. LIMPIEZA de registros huerfanos:
     - drive_files donde drive_file_id ya no existe en Drive -> DELETE de drive_files
     - project_folders donde drive_folder_id ya no existe en Drive -> DELETE de project_folders
```

### Secuencia de implementacion

1. Agregar accion `get_project_drive_id` al edge function `sync-drive`
2. Agregar accion `reverse_sync` al edge function `sync-drive`
3. Agregar boton "Ver en Google Drive" en `ProyectoRepositorioDialog.tsx`
4. Modificar el flujo de sync en el frontend para incluir reverse sync automatico
5. Actualizar `useDriveSync.ts` con los nuevos hooks necesarios

