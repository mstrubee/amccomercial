
Objetivo: eliminar definitivamente el error `ERR_BLOCKED_BY_RESPONSE` al abrir archivos de Drive, garantizando que nunca se intenten renderizar dentro del iframe de la app y que siempre se abran en pestaña nueva.

Diagnóstico confirmado:
1. Ya estás usando `window.open(...)` en:
   - `src/components/repositorio/FolderTreeNode.tsx` (archivos)
   - `src/components/repositorio/ProyectoRepositorioDialog.tsx` (carpeta del proyecto)
2. Pero ambos flujos hacen una llamada async antes de abrir la pestaña (`await mutateAsync(...)`), lo que puede romper el “user gesture context” del navegador.
3. En entornos embebidos (preview en iframe), cuando se pierde ese contexto, el navegador puede bloquear o resolver navegación de forma no deseada, produciendo errores como `ERR_BLOCKED_BY_RESPONSE` / bloqueo por política de frame.
4. El problema no es solo “usar window.open”, sino usarlo en el momento correcto: inmediatamente en el click, antes del `await`.

Implementación propuesta:

1) Robustecer apertura de archivos en `FolderTreeNode.tsx`
- Mantener uso exclusivo de `web_view_link` (correcto para visualización).
- Cambiar `handleViewFile` a patrón “pre-open tab”:
  - Abrir pestaña vacía de inmediato en el click:
    - `const newTab = window.open("", "_blank", "noopener,noreferrer")`
  - Si `newTab` es null: mostrar toast de popup bloqueado y salir.
  - Luego ejecutar `await getViewUrl.mutateAsync(...)`.
  - Si hay `web_view_link`: asignar `newTab.location.href = web_view_link`.
  - Si no hay link o hay error: `newTab.close()` + toast explicativo.
  - Mantener hardening: `if (newTab) newTab.opener = null`.
  
Resultado: la pestaña nace por gesto del usuario, evitando bloqueos y evitando cualquier intento de render dentro del iframe.

2) Aplicar el mismo patrón al botón “Ver en Google Drive” en `ProyectoRepositorioDialog.tsx`
- En el `onClick` del botón:
  - `const newTab = window.open("", "_blank", "noopener,noreferrer")` al inicio.
  - Validar bloqueo (`!newTab`) y notificar.
  - Hacer `await getProjectDriveId.mutateAsync(...)`.
  - Construir URL final `https://drive.google.com/drive/folders/{drive_folder_id}`.
  - Redirigir pestaña: `newTab.location.href = url`.
  - Si falla el fetch del id: `newTab.close()` + toast.
  - Mantener `newTab.opener = null`.
  
Resultado: consistencia entre apertura de carpeta y apertura de archivo, minimizando bloqueos del navegador en iframe.

3) Mantener contrato de URL correcto en hooks
- `src/hooks/useDriveSync.ts`:
  - No se requiere cambio funcional mayor si ya devuelve `web_view_link`.
  - Mantener el uso en UI de `web_view_link` como fuente principal para abrir archivos.
- No hace falta tocar backend para este ajuste, salvo que quieras endurecer el contrato tipado más adelante.

Secuencia recomendada de ejecución:
1. Ajustar `handleViewFile` en `FolderTreeNode.tsx` con patrón pre-open.
2. Ajustar botón “Ver en Google Drive” en `ProyectoRepositorioDialog.tsx` con patrón pre-open.
3. Validar UX de errores (popup bloqueado, link nulo, error de función).
4. Probar fin a fin en preview y en app publicada.

Validación end-to-end (obligatoria):
1. Abrir repositorio y hacer clic en un archivo:
   - Debe abrir pestaña nueva.
   - No debe aparecer intento de iframe.
2. Clic en “Ver en Google Drive”:
   - Debe abrir carpeta en nueva pestaña.
3. Probar con popup blocker activo y desactivado:
   - Debe mostrar mensaje claro si el navegador bloquea.
4. Repetir en URL publicada:
   - Confirmar comportamiento estable fuera del entorno de preview.

Riesgos y mitigaciones:
- Popup bloqueado por configuración del navegador:
  - Mitigar con mensaje claro: “Tu navegador bloqueó la apertura de pestañas. Habilita popups para este sitio.”
- Fallo en `get-drive-view-url` o `get_project_drive_id`:
  - Cerrar pestaña en blanco automáticamente para no dejar basura UX.
- `web_view_link` nulo:
  - Mostrar error específico y cerrar pestaña temporal.

Resultado esperado:
- Ningún archivo/carpeta de Drive intentará abrirse dentro de la app.
- Todo se abrirá en pestaña nueva de forma confiable.
- Se minimizan bloqueos por políticas de iframe al preservar el gesto de usuario desde el inicio del click.
