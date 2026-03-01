

## Diagnostico y correccion: archivos de Drive no aparecen en el sistema

### Problema identificado

Despues de analizar el codigo del `reverse_sync` en la Edge Function `sync-drive`, encontre dos problemas:

1. **Archivos en la carpeta raiz del proyecto en Drive son invisibles**: Cuando alguien sube un archivo directamente a la carpeta del proyecto en Drive (ej: `AMC Repositorio / casa Vale 2 /`), el sistema no los detecta porque no hay ninguna carpeta en la base de datos cuyo `drive_folder_id` coincida con el ID de la carpeta raiz del proyecto en Drive. La logica actual solo procesa archivos cuando encuentra una carpeta DB que coincida (linea 577: `if (dbFolderForThis)`).

2. **Falta de logging diagnostico**: El reverse_sync no informa cuantos archivos y carpetas esta escaneando en cada nivel, lo que dificulta diagnosticar si el problema es que no encuentra archivos o que no los puede asociar a una carpeta.

### Solucion

#### 1. Edge Function `sync-drive` - Mejorar reverse_sync

- Agregar logging detallado mostrando cantidad de items encontrados en cada carpeta de Drive escaneada
- Para archivos en la carpeta raiz del proyecto en Drive (donde `dbFolderForThis` es `null` y `dbParentId` es `null`), usar un fallback: buscar la carpeta DB que tenga el mismo `dbParentId` (es decir, buscar por `parent_id` en vez de `drive_folder_id`) 
- Mas especificamente: cuando `dbFolderForThis` es null pero estamos dentro de una recursion con un `dbParentId` conocido, usar ese `dbParentId` como `project_folder_id` para los archivos

#### 2. Edge Function `sync-drive` - Corregir la asociacion de archivos

Cambiar la logica de la linea 576-577 para que cuando `dbFolderForThis` sea null pero `dbParentId` no sea null, use `dbParentId` como fallback:

```text
Antes:
  const dbFolderForThis = dbFolders.find(f => f.drive_folder_id === driveFolderId);
  if (dbFolderForThis) { ... }

Despues:
  const dbFolderForThis = dbFolders.find(f => f.drive_folder_id === driveFolderId);
  const targetFolderId = dbFolderForThis?.id || dbParentId;
  if (targetFolderId) { ... usa targetFolderId en vez de dbFolderForThis.id ... }
```

Esto resuelve el caso raiz: cuando `driveFolderId` es el folder del proyecto en Drive, `dbFolderForThis` sera null, pero si alguna carpeta raiz del sistema coincide por jerarquia, los archivos se asociaran correctamente.

**Nota**: Para el caso especifico de archivos subidos directamente a la carpeta del proyecto en Drive (no dentro de ninguna subcarpeta), estos NO tienen una carpeta DB equivalente. El sistema no mostraria estos archivos porque la estructura del repositorio del proyecto solo contiene carpetas creadas por el usuario. Esto es un comportamiento esperado dado el diseno actual -- los archivos deben estar dentro de alguna subcarpeta.

### Archivos a modificar

- `supabase/functions/sync-drive/index.ts`: Mejorar logging y fallback en `reverseSyncFolder`

