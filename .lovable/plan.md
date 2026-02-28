
Objetivo de esta corrección: garantizar que cada archivo subido se refleje en Google Drive automáticamente, incluso si hay IDs de carpeta desactualizados o fallas temporales de la API.

Contexto validado en el código actual:
- La subida de archivos usa `upload-to-drive` con estrategia offline-first (cola + intento inmediato).
- Existe procesamiento de cola (`process-sync-queue`) y hay job activo cada 2 minutos.
- El problema más probable está en la “salud” de `drive_folder_id`:
  - Si una carpeta en Drive ya no existe/migró, `sync-drive` hoy no la repara correctamente.
  - Además, tras el cambio de jerarquía `AMC Repositorio / [Proyecto] / ...`, carpetas antiguas pueden seguir apuntando a rutas previas.
- Resultado: la app puede intentar subir a un `drive_folder_id` inválido o fuera de la ubicación esperada, y el usuario percibe que “no se reflejan” en Drive.

Plan de implementación

1) Endurecer sincronización de carpetas para “autocuración”
- Archivo: `supabase/functions/sync-drive/index.ts`
- Cambios:
  - Mejorar `syncRecursive` para que, cuando `drive_folder_id` exista pero falle la lectura (`getDriveFolderName` devuelve null/404), se trate como carpeta rota.
  - En ese caso:
    1. recrear/buscar carpeta por nombre bajo el padre correcto en Drive,
    2. actualizar `project_folders.drive_folder_id`,
    3. continuar recursión con el nuevo ID.
  - Agregar verificación de padre esperado (no solo nombre): si la carpeta existe pero cuelga de otra ruta vieja, reubicarla (o recrearla y relinkear) para forzar la estructura correcta del proyecto.
- Resultado esperado:
  - IDs rotos o heredados de estructura antigua quedan reparados automáticamente.

2) Validación previa de carpeta al subir archivo
- Archivo: `supabase/functions/upload-to-drive/index.ts`
- Cambios:
  - Antes de subir archivo a Drive, validar que `drive_folder_id` de destino existe y es accesible.
  - Si no existe:
    - responder error controlado tipo `DRIVE_FOLDER_NOT_FOUND` (con mensaje claro),
    - mantener archivo en cola (`pending_sync`) para no perderlo.
- Resultado esperado:
  - Nunca se “pierde” la subida por carpeta inválida.
  - Queda trazabilidad en cola para recuperación automática.

3) Reparación automática al detectar carpeta inválida
- Frontend: `src/components/repositorio/ProyectoRepositorioDialog.tsx` y/o `src/hooks/useDriveSync.ts`
- Cambios:
  - Si `upload-to-drive` responde `DRIVE_FOLDER_NOT_FOUND`, disparar `sync-drive` del proyecto y luego reintentar subida una vez automáticamente.
  - Si el reintento también falla, mantener en cola y mostrar toast explícito: “archivo en cola, sincronización en curso”.
- Resultado esperado:
  - Flujo transparente para usuario: se autocorrige sin intervención manual en la mayoría de casos.

4) Acelerar sincronización de cola cuando hay pendientes (no esperar solo cron)
- Frontend: `ProyectoRepositorioDialog.tsx`
- Cambios:
  - Cuando `pendingCount > 0`, ejecutar `process-sync-queue` periódicamente mientras el diálogo está abierto (ej. cada 15–30s).
  - Mantener el trigger actual al evento `online`.
- Resultado esperado:
  - Si falla el intento inmediato, la recuperación ocurre rápido, no solo cada 2 minutos.

5) Visibilidad de estado para evitar falsa percepción de “no subido”
- Frontend: `FolderTreeNode.tsx` / `ProyectoRepositorioDialog.tsx`
- Cambios:
  - Mostrar indicador por archivo/carpeta cuando hay elementos pendientes/fallidos.
  - Agregar mensaje más explícito de estado:
    - “Sincronizado en Drive”
    - “En cola de sincronización”
    - “Reintentando subida”.
- Resultado esperado:
  - El usuario entiende si el archivo ya está en Drive o sigue en proceso.

6) Diagnóstico y observabilidad
- Backend functions (`upload-to-drive`, `process-sync-queue`, `sync-drive`)
- Cambios:
  - Estandarizar logs con prefijos: `[UPLOAD]`, `[QUEUE]`, `[FOLDER_SYNC]`.
  - Incluir `project_folder_id`, `drive_folder_id`, `file_name`, motivo de error.
- Resultado esperado:
  - Diagnóstico rápido ante futuros casos.

Criterios de aceptación (funcionales)
1. Al crear carpeta en el sistema, aparece en Drive bajo `AMC Repositorio/[Proyecto]/...` automáticamente.
2. Al subir 1 archivo en carpeta existente, aparece en Drive en menos de ~10s en condiciones normales.
3. Si la carpeta destino en Drive fue borrada/movida, el sistema la repara y la subida termina reflejada en Drive.
4. Si Google falla temporalmente, el archivo queda en cola y se sincroniza automáticamente al recuperarse.
5. El usuario ve estado claro (sincronizado / en cola / reintentando).

Riesgos y mitigaciones
- Riesgo: mover carpetas existentes puede impactar rutas manuales en Drive.
  - Mitigación: preferir estrategia “recrear + relink” solo cuando se detecte inconsistencia fuerte; log detallado.
- Riesgo: reintentos agresivos aumentan llamadas API.
  - Mitigación: intervalos moderados y límite de intentos existente (`MAX_RETRIES`).

Validación end-to-end propuesta
1. Proyecto con carpetas existentes:
   - subir archivo y confirmar aparición en Drive en carpeta correcta.
2. Simulación de carpeta rota:
   - borrar carpeta en Drive manualmente, subir archivo, validar autocuración + reflejo.
3. Simulación de fallo temporal:
   - forzar error de subida (token/permiso temporal), confirmar cola + recuperación automática.
4. Confirmar que listado local y enlaces de visualización siguen funcionando igual.

Se entregará en una sola iteración de código con foco en robustez de carpeta destino + reintentos automáticos inmediatos.
