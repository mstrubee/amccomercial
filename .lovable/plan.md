## Objetivo

Transformar el textarea "Nota grupo" del listado de proyectos en un **Checklist de Proyecto** con las mismas capacidades que el checklist de empresas (jerárquico, fechas, autores, menciones @, editar/eliminar, sub-ítems, follow-up al completar, ocultar/mostrar completados). Debe quedar **separado** del checklist de empresas — no se mezclan datos. Además, el fondo del área de entrada debe ser **celeste con 50% de transparencia** (no color sólido).

## Estrategia

Reutilizar la tabla `empresa_checklist_items` (misma estructura, mismos triggers de menciones, misma página Menciones sin cambios) permitiendo filas de **solo proyecto** (`empresa_id = NULL`, `proyecto_id` = id del proyecto). Los checklists de empresa (`empresa_id` NOT NULL) y los de proyecto (`empresa_id` NULL) quedan totalmente separados por filtro. Se agrega un componente dedicado `ProyectoChecklistPanel` para el listado.

## Cambios

### 1) Base de datos (migración)
- `ALTER TABLE empresa_checklist_items ALTER COLUMN empresa_id DROP NOT NULL;`
- Restricción `CHECK (empresa_id IS NOT NULL OR proyecto_id IS NOT NULL)` para asegurar coherencia.
- Verificar/ajustar policies RLS existentes para permitir filas con `empresa_id NULL` acotadas por `proyecto_id` (misma política que usa `has_project_access` o equivalente ya vigente para proyecto_id).
- El trigger `sync_checklist_mentions` sigue funcionando (usa `NEW.proyecto_id` / `NEW.empresa_id` tal cual).

### 2) Hooks (`src/hooks/useProyectoChecklist.ts` — nuevo)
Envolturas delgadas sobre `empresa_checklist_items` con filtro `empresa_id IS NULL AND proyecto_id = X`:
- `useProyectoChecklistItems(proyectoId)`
- `useAddProyectoChecklistItem`, `useToggle...`, `useUpdate...Text`, `useUpdate...Date`, `useDelete...`, `useDelete...Recursive`
- Reutilizan `parseDateFromText` de `useEmpresaChecklist`.

### 3) Componente `src/components/proyectos/ProyectoChecklistPanel.tsx` (nuevo)
Copia adaptada de `EmpresaChecklistPanel`:
- Sin `empresaId`; solo `proyectoId`.
- Mismas funcionalidades: menciones vía `MentionTextarea`, edición inline con `@`, sub-ítems, follow-up dialog, editar fecha, ocultar/mostrar completados, autoría "(nombre)".
- Reemplaza el textarea actual "Nota grupo" en `src/pages/Proyectos.tsx` (línea 1432, `NotaGrupoCell`).

### 4) Estilos
- `MentionTextarea` de entrada dentro del panel usa fondo **celeste 50%**: `bg-sky-300/50` (Tailwind) — no sólido. Se pasa vía `className` sobreescribiendo `bg-*` del componente por defecto.
- El resto del panel (lista de ítems, hover, etc.) mantiene el estilo del checklist de empresas.

### 5) Remoción / limpieza
- Se elimina `NotaGrupoCell` (o se deja como fallback opcional detrás del panel). La columna DB `proyectos.nota_grupo` se **conserva sin cambios** (no se toca) para no perder datos históricos; se puede mostrar en modo lectura si contiene texto, pero la nueva escritura va al checklist.

## Fuera de alcance
- No se modifica la página Menciones (ya soporta `proyecto_id` sin `empresa_id`).
- No se altera el checklist de empresas.
- No se migran las notas existentes en `proyectos.nota_grupo` a ítems de checklist.
