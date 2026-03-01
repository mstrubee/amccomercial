
Objetivo
Corregir el bloqueo `ERR_BLOCKED_BY_RESPONSE` para que ningún enlace de Google Drive se intente abrir dentro del iframe de la app, y que la apertura sea siempre externa en pestaña nueva con `window.open(url, "_blank")` ejecutado en contexto de clic del usuario.

Hallazgos confirmados en el código actual
1. `FolderTreeNode.tsx` hoy abre archivos con un `<a>` oculto (`target="_blank"`) y `click()` programático.
2. `ProyectoRepositorioDialog.tsx` también usa `<a>` oculto para “Ver en Google Drive”, pero primero hace `await getProjectDriveId.mutateAsync(...)`.
3. Ese `await` antes de abrir la navegación puede perder el “user gesture context” en entorno embebido (preview iframe), lo que provoca bloqueos o apertura errática (`about:blank`, `ERR_BLOCKED_BY_RESPONSE`).
4. No hay necesidad de iframe/modal para visualización; la URL de archivo ya puede construirse directamente con formato de previsualización de Drive.

Causa raíz más probable
La navegación externa no está ocurriendo de forma completamente síncrona respecto al clic en todos los flujos (especialmente el botón de carpeta). En entorno iframe, eso aumenta la probabilidad de bloqueo por políticas del navegador.

Estrategia de solución
Eliminar el patrón de `<a>` oculto para apertura de Drive y unificar apertura con `window.open(...)` en el propio handler de clic, usando URL válida ya resuelta (o, si no está lista, mostrar estado “Cargando...” sin intentar abrir).

Cambios propuestos (sin tocar backend ni base de datos)

1) `src/components/repositorio/FolderTreeNode.tsx`
- Reemplazar apertura por `<a>` oculto con apertura directa:
  - Construir URL: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`.
  - Ejecutar inmediatamente en clic: `window.open(viewUrl, "_blank", "noopener,noreferrer")`.
- Validación previa de `fileId`:
  - Si falta/está vacío: toast de error claro (“No se encontró el ID del archivo”).
  - Si está en estado no disponible (caso extremo): toast “Cargando...” / “Intenta nuevamente”.
- Robustez opcional:
  - Normalizar `fileId` por si llega URL completa accidentalmente (extraer ID con regex), luego usar formato estándar de preview.

2) `src/components/repositorio/ProyectoRepositorioDialog.tsx`
- Eliminar patrón de `<a>` oculto (`driveLinkRef`) para “Ver en Google Drive”.
- Evitar depender de async en el mismo clic:
  - Pre-resolver en background el `drive_folder_id` al abrir diálogo (o cuando `projectId/projectName` cambien) y guardarlo en estado local `projectDriveUrl`.
  - En el clic del botón:
    - Si `projectDriveUrl` existe: `window.open(projectDriveUrl, "_blank", "noopener,noreferrer")` inmediato.
    - Si no existe aún: mostrar “Cargando enlace de Drive...” y no intentar abrir hasta tener URL (evita `about:blank`).
- Mantener feedback visual del botón (loading state) durante precarga del enlace.

3) Limpieza de código relacionada
- Quitar refs/estado no usados del enfoque anterior basado en anchor oculto.
- Mantener mensajes de error consistentes con toasts actuales.

Por qué esta solución
- Cumple exactamente lo pedido: sin iframe/modales internos, apertura externa con `window.open`.
- Reduce al mínimo bloqueos por seguridad del navegador en contexto embebido.
- Evita pestañas vacías y el síntoma `about:blank` al no abrir si aún no hay URL válida.
- Usa formato de URL de Drive correcto para visualización.

Riesgos y mitigaciones
1. Popup bloqueado por navegador:
- Mitigación: ejecutar `window.open` únicamente dentro del clic cuando la URL ya está lista.
- Mensaje claro al usuario si el navegador bloquea popups.

2. URL de carpeta aún no disponible:
- Mitigación: precarga anticipada + estado “Cargando...”, sin abrir pestaña vacía.

3. `fileId` inconsistente:
- Mitigación: validación/normalización antes de construir la URL.

Validación end-to-end (obligatoria)
1. En `/proyectos`, abrir repositorio y hacer clic en varios archivos:
- Deben abrir en pestaña nueva.
- No debe aparecer `about:blank`.
- No debe aparecer `ERR_BLOCKED_BY_RESPONSE`.
2. Hacer clic en “Ver en Google Drive”:
- Debe abrir carpeta en pestaña nueva cuando URL esté lista.
- Si aún se está resolviendo, debe mostrar feedback “Cargando...” sin navegación fallida.
3. Repetir pruebas en Preview y en URL publicada para confirmar comportamiento consistente.
4. Probar 2-3 tipos de archivo distintos (PDF, doc, hoja) para validar formato de URL de preview.

Resultado esperado
- Cero intentos de render de Drive dentro del iframe de la app.
- Apertura externa confiable en pestaña nueva.
- Eliminación práctica de errores `about:blank` y `ERR_BLOCKED_BY_RESPONSE` en los flujos de visualización.
