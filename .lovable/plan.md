

## Correccion: archivos subidos en Drive no aparecen en el sistema (reverse_sync)

### Problema encontrado

Despues de analizar el codigo y los logs, identifique un bug critico en la logica de limpieza de archivos del `reverse_sync`:

**Bug en la limpieza de archivos (lineas 604-612)**: Cuando se escanea una carpeta de Drive, el codigo obtiene TODOS los archivos de la BD para ese `project_folder_id`, pero luego los compara solo contra los archivos de la carpeta de Drive ACTUAL. Si un archivo fue subido desde el sistema (y tiene un `drive_folder_id` diferente por migracion/reparacion), seria eliminado incorrectamente de la BD porque no aparece en la lista de archivos de la carpeta de Drive que se esta escaneando.

Ademas, hay un problema con los archivos nuevos: cuando la carpeta de Drive escaneada tiene `0 files`, el bloque completo de archivos se salta (condicion `driveFiles.length > 0`), lo cual significa que NO se ejecuta la limpieza de archivos eliminados en carpetas vacias de Drive.

### Solucion

#### Archivo: `supabase/functions/sync-drive/index.ts`

**1. Corregir la limpieza de archivos para filtrar por `drive_folder_id`**

La consulta de archivos existentes debe incluir el filtro `drive_folder_id = driveFolderId` para solo comparar archivos que pertenecen a la carpeta de Drive que se esta escaneando:

```text
Antes:
  const { data: existingFiles } = await admin
    .from("drive_files")
    .select("id, drive_file_id")
    .eq("project_folder_id", targetFolderId);

Despues:
  const { data: existingFiles } = await admin
    .from("drive_files")
    .select("id, drive_file_id")
    .eq("project_folder_id", targetFolderId)
    .eq("drive_folder_id", driveFolderId);
```

**2. Separar la logica de agregar archivos de la logica de limpiar archivos**

Actualmente ambas estan dentro del bloque `if (targetFolderId && driveFiles.length > 0)`. La limpieza de archivos eliminados en Drive debe ejecutarse incluso cuando `driveFiles.length === 0` (carpeta vacia en Drive = todos los archivos fueron borrados):

```text
// Agregar archivos nuevos (solo si hay archivos en Drive)
if (targetFolderId && driveFiles.length > 0) {
  // ... insertar archivos nuevos ...
}

// Limpiar archivos eliminados en Drive (siempre que haya una carpeta DB mapeada)
if (targetFolderId) {
  const { data: existingFiles } = await admin
    .from("drive_files")
    .select("id, drive_file_id")
    .eq("project_folder_id", targetFolderId)
    .eq("drive_folder_id", driveFolderId);
  
  const driveFileIds = new Set(driveFiles.map(f => f.id));
  for (const ef of (existingFiles || [])) {
    if (!driveFileIds.has(ef.drive_file_id)) {
      await admin.from("drive_files").delete().eq("id", ef.id);
      stats.files_removed++;
    }
  }
}
```

**3. Agregar logging adicional para diagnostico**

Agregar log cuando se detectan archivos ya existentes (skip) para confirmar que el sistema los ve correctamente.

### Resumen de cambios

- Solo se modifica: `supabase/functions/sync-drive/index.ts`
- Se corrige el filtro de limpieza para evitar eliminar archivos de otras carpetas de Drive
- Se separa la logica de insercion y limpieza de archivos
- Se mantiene todo el comportamiento existente de sincronizacion de carpetas

