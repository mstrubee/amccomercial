
Objetivo: corregir definitivamente la apertura de “Ver en Google Drive/Earth” para que nunca intente renderizar contenido de Google dentro del sistema (iframe), y siempre abra en una pestaña nueva usando el enlace de visualización correcto (`webViewLink`) con medidas de seguridad.

## Diagnóstico (paso a paso)

1. Ya existe lógica para abrir archivos desde `FolderTreeNode.tsx`:
   - llama `useGetDriveViewUrl()`
   - recibe `web_view_link` y `web_content_link`
   - hoy usa `web_view_link || web_content_link`
   - abre con `window.open(url, "_blank")` (sin `noopener/noreferrer`)

2. El botón de carpeta del proyecto (“Ver en Google Drive”) en `ProyectoRepositorioDialog.tsx` actualmente usa un `<a>` oculto y click programático (workaround de iframe).
3. El error que reportas (“Refused to display in a frame”) indica que en algún flujo se está intentando mostrar URL de Google en contexto embebido o con apertura no segura/consistente.
4. Tu requerimiento pide explícitamente:
   - `window.open(fileUrl, "_blank")`
   - seguridad equivalente a `rel="noopener noreferrer"`
   - usar la URL de visualización de Google (`webViewLink`).

## Implementación propuesta

### 1) Forzar uso de `webViewLink` para archivos (sin fallback a `webContentLink`)
**Archivo:** `src/components/repositorio/FolderTreeNode.tsx`

Cambios:
- En `handleViewFile`, usar **solo** `result.web_view_link`.
- Si `web_view_link` viene nulo, mostrar toast claro (“No se pudo obtener enlace de visualización”) en vez de usar `web_content_link`.
- Abrir con:
  - `window.open(viewUrl, "_blank", "noopener,noreferrer")`
  - y refuerzo: `newWindow.opener = null` cuando aplique.

Motivo:
- `webViewLink` es el enlace diseñado por Google para visualización en navegador.
- Evita rutas de descarga/preview que pueden comportarse distinto en entornos embebidos.

### 2) Unificar apertura segura en pestaña nueva para el botón de carpeta del proyecto
**Archivo:** `src/components/repositorio/ProyectoRepositorioDialog.tsx`

Cambios:
- Reemplazar el flujo de `<a>` oculto + `setTimeout` por apertura directa:
  - obtener `drive_folder_id`
  - construir URL `https://drive.google.com/drive/folders/{id}`
  - `window.open(url, "_blank", "noopener,noreferrer")`
  - `opener = null` como hardening adicional.
- Eliminar estado/ref usados solo para el anchor oculto (`driveUrl`, `driveLinkRef`) para simplificar.

Motivo:
- Queda alineado con tu instrucción de usar `window.open`.
- Menos complejidad y menos puntos de falla.

### 3) Mantener API de backend compatible, pero reforzar contrato de “URL de vista”
**Archivos:**
- `src/hooks/useDriveSync.ts`
- (opcional mínimo) `supabase/functions/get-drive-view-url/index.ts`

Cambios:
- En frontend, tratar `web_view_link` como campo principal obligatorio para abrir vista.
- Opcional backend (recomendado): seguir devolviendo ambos campos por compatibilidad, pero documentar/normalizar que `web_view_link` es el que debe usarse en UI.

Motivo:
- Evita romper otras partes si existieran consumidores antiguos.
- Garantiza que el botón use exactamente el tipo de URL que pediste.

## Secuencia de ejecución

1. Ajustar `FolderTreeNode.tsx` (uso estricto de `web_view_link` + open seguro).
2. Ajustar `ProyectoRepositorioDialog.tsx` (quitar anchor oculto y usar `window.open` seguro).
3. Ajustar tipado/uso en `useDriveSync.ts` si hace falta para reflejar contrato de apertura.
4. Verificación funcional en preview y URL publicada.

## Validación end-to-end (clave)

1. En repositorio del proyecto, hacer clic en:
   - “Ver en Google Drive” (carpeta)
   - un archivo dentro del árbol (vista de archivo)
2. Confirmar:
   - se abre una nueva pestaña del navegador
   - no intenta incrustar Google en el panel de la app
   - no aparece error “Refused to display in a frame”
3. Probar 2 tipos de archivo (por ejemplo PDF y Doc/Sheet) para confirmar consistencia con `webViewLink`.
4. Repetir prueba en entorno publicado para descartar restricciones propias del preview embebido.

## Riesgos y mitigaciones

- **Popup bloqueado por navegador:** si el navegador bloquea popups, mantener apertura estrictamente dentro del evento de click (sin esperas asíncronas intermedias innecesarias).
- **`webViewLink` nulo en casos raros:** mostrar mensaje de error claro al usuario y registrar en consola para diagnóstico.
- **Comportamiento distinto preview vs publicado:** validar ambos contextos; el publicado es la referencia final para UX real.

## Resultado esperado

- El botón de Drive/Earth abre siempre en pestaña nueva.
- Se elimina el intento de renderizar contenido de Google dentro de iframe.
- Se usa la URL correcta de Google para visualización (`webViewLink`) y se aplica hardening de seguridad equivalente a `rel="noopener noreferrer"`.
