## Plan: Menciones @usuario en checklist + Leído/No leído + Sección "Menciones"

### 1. Backend (1 migración)

**Tablas nuevas:**
- `checklist_mentions` — vincula una nota del checklist con un usuario mencionado
  - `checklist_item_id` (FK a `empresa_checklist_items`, cascade delete)
  - `mentioned_user_id` (UUID, ref auth.users)
  - `proyecto_id`, `empresa_id` (denormalizado para queries rápidas)
  - índice único `(checklist_item_id, mentioned_user_id)`
  - RLS: SELECT permitido al usuario mencionado y al autor; INSERT/DELETE solo autor o admin
  - GRANTs estándar a `authenticated` y `service_role`

- `checklist_mention_reads` — estado leído/no leído por mención
  - `mention_id` (FK), `user_id`, `read_at`
  - único `(mention_id, user_id)`
  - RLS: cada usuario gestiona sus propias filas

**Trigger automático:**
- Función `sync_checklist_mentions()` que se dispara `AFTER INSERT/UPDATE OF text` en `empresa_checklist_items`:
  - Parsea `@token` del texto, busca en `profiles.display_name` (normalizando: minúsculas, sin espacios)
  - Reemplaza filas en `checklist_mentions` para ese item

### 2. Componente reutilizable `MentionTextarea`

`src/components/mensajeria/MentionTextarea.tsx` — wrapper de `<Textarea>`:
- Detecta `@` activo (último `@` antes del caret, sin espacio)
- Muestra `Popover` con lista de usuarios (`profiles.display_name`), filtrada en vivo
- Navegación con ↑/↓, selección con `Enter` o `Space` → inserta `@nombresincompresion`
- `Escape` cierra el popover

Reemplazará los `<Textarea>` de:
- `EmpresaChecklistPanel.tsx` (nueva nota, follow-up, sub-item)
- `NotaGrupoCell` en `Proyectos.tsx` (nota grupo del proyecto)

### 3. Render de menciones

En el texto del checklist y nota grupo, renderizar `@nombre` como chip azul (span estilizado). Helper compartido `renderTextWithMentions(text)`.

### 4. Toggle Leído / No leído en el checklist

En `EmpresaChecklistPanel`:
- Para ítems donde el usuario actual está mencionado, mostrar un icono `Eye`/`EyeOff` al hover, junto a las acciones existentes
- Click marca/desmarca `checklist_mention_reads` para el `mention_id` del usuario actual
- Filtro adicional junto a "Mostrar completados": botón "Solo no leídas" que aplica únicamente a ítems con menciones del usuario

### 5. Sección "Menciones" en navegación

**Ruta nueva:** `/menciones` (página `src/pages/Menciones.tsx`).

**Acceso:**
- En el header de `Alertas.tsx` (junto a Árbol/Clasificación/Eliminadas), botón "Menciones" con badge de no-leídas
- También en el sidebar bajo el grupo Alertas (subentrada)

**Página Menciones:**
- Hook `useMyMentions()` que trae menciones del usuario actual con join a `empresa_checklist_items`, `proyectos`, `empresas`, profiles (autor)
- Tabs: **No leídas** (default) / **Leídas** / **Todas**
- Agrupado por proyecto (collapsible). Cada fila muestra: fecha, autor, empresa, texto con mención resaltada, botón "Ir al proyecto", botón marcar leída/no leída
- "Ir al proyecto" → navega a `/proyectos` con `sessionStorage.menciones_return = "/menciones"` y abre el dialog del proyecto (reutilizar lógica de snapshot existente). Al marcar como visto se marca `read_at`.

### 6. Botón flotante "Volver a Menciones"

Crear `src/components/menciones/BackToMencionesFloat.tsx` (calcado de `BackToProyectoFloat`/`BackToAlertasFloat`):
- Se monta en `AppLayout.tsx`
- Lee `sessionStorage.menciones_return`. Si existe y la ruta actual no es `/menciones`, muestra botón flotante "← Volver a Menciones" (esquina superior derecha, always-on-top, cerrable)
- Al cerrarse limpia el flag

### 7. Hook permissions / sidebar

- Añadir entrada `menciones` opcional en `ALL_SECTIONS` (visible para todos por defecto). Sin migración de permisos: simplemente visible.
- Sidebar: agregar item dentro del grupo Alertas.

### Archivos a tocar
- **Migración** (1): tablas + trigger + RLS + grants
- **Nuevos**: `MentionTextarea.tsx`, `renderTextWithMentions.ts`, `Menciones.tsx`, `useMyMentions.ts`, `useMentionReads.ts`, `BackToMencionesFloat.tsx`
- **Editados**: `EmpresaChecklistPanel.tsx`, `Proyectos.tsx` (NotaGrupoCell), `Alertas.tsx` (botón header), `AppLayout.tsx` (sidebar + floater), `App.tsx` (ruta), `useEmpresaChecklist.ts` (tipo `ChecklistItem` no requiere cambios)

### Detalles técnicos (no técnico: omitir)
- Matching de `@token` contra `display_name`: normalizar quitando espacios/acentos en ambos lados; ambiguos → no se crea mención (requiere selección exacta desde el dropdown, que insertará el handle sin espacios)
- Trigger usa `regexp_matches` con `@([\w]+)` y resuelve en `profiles`
- Realtime: opcionalmente subscribirse a `checklist_mentions` para badge en vivo (fase 2, no incluido ahora)