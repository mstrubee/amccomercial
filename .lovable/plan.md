

## Plan: "Hitos Ejecución Proyectos" — Checklist global para fase de obra

Crear una nueva sección administrativa que permite definir una **plantilla de checklist** (con columnas y filas configurables). Esta plantilla se aplica automáticamente a cada empresa de un proyecto cuando el proyecto entra en fase **"Obra/Ejecución"**, mostrándose como un panel **colapsado** en la línea de empresa del listado de Proyectos.

---

### 1. Nueva entrada en menú de Administración

En `src/components/layout/AppLayout.tsx`, agregar al final de `allAdminSubItems`:

- **"Hitos Ejecución Proyectos"** → ruta `/hitos-ejecucion`, ícono `ClipboardList`, solo admin.

Registrar la ruta en `src/App.tsx` (lazy).

---

### 2. Modelo de datos (nuevas tablas)

**`hitos_template_columns`** — columnas de la plantilla global
- `id` uuid PK
- `nombre` text — título de la columna
- `tipo` text — `"texto"` o `"select"`
- `orden` int
- `created_at` timestamptz

**`hitos_template_column_options`** — opciones para columnas tipo `select`
- `id` uuid PK
- `column_id` uuid → `hitos_template_columns.id`
- `valor` text
- `orden` int

**`hitos_template_rows`** — filas predefinidas de la plantilla
- `id` uuid PK
- `orden` int
- `created_at` timestamptz

**`hitos_proyecto_empresa_values`** — valores capturados por proyecto-empresa
- `id` uuid PK
- `proyecto_empresa_id` uuid → `proyecto_empresas.id`
- `row_id` uuid → `hitos_template_rows.id` (nullable para filas extra agregadas en línea)
- `column_id` uuid → `hitos_template_columns.id`
- `valor` text
- `created_by` uuid, `updated_at` timestamptz
- UNIQUE (`proyecto_empresa_id`, `row_id`, `column_id`)

**`hitos_proyecto_empresa_extra_rows`** — filas extra agregadas a una empresa específica (opcional)
- `id` uuid PK
- `proyecto_empresa_id` uuid
- `orden` int

**RLS:**
- Templates (`columns`, `column_options`, `rows`): SELECT autenticado, ALL solo admin.
- Values y extra_rows: SELECT/INSERT/UPDATE/DELETE para admin y `usuario_tipo_1`.

Plantilla inicial sembrada con **3 columnas** (`Hito` texto, `Estado` select con opciones "Pendiente/En curso/Completado", `Observación` texto).

---

### 3. Página Admin: `/hitos-ejecucion`

`src/pages/HitosEjecucionPage.tsx` — interfaz para administrar la plantilla global:

- Tabla editable: filas = `hitos_template_rows`, columnas = `hitos_template_columns`.
- Botón **"Agregar columna"**: pide nombre + tipo (texto/select). Si select, abre subdiálogo para gestionar opciones.
- Botón **"Agregar fila"**.
- Cada columna tiene menú: editar nombre, cambiar tipo, gestionar opciones, eliminar.
- Cada fila tiene botón eliminar.
- Reordenamiento por flechas ↑↓ (campo `orden`).

Hook nuevo: `src/hooks/useHitosTemplate.ts` con queries/mutations para columnas, opciones y filas.

---

### 4. Panel colapsable en línea de empresa (Proyectos)

Modificar `src/pages/Proyectos.tsx` en la sección de child rows (alrededor de línea 860–905):

- Después del `<motion.tr>` de cada empresa, insertar **una fila adicional condicional** cuando `p.estado_obra === "Obra/Ejecución"`:
  ```text
  <tr> [empresa cells normales] </tr>
  <tr [solo si estado_obra === "Obra/Ejecución"]>
    <td colSpan={10}>
      <HitosEjecucionPanel proyectoEmpresaId={pe.id} />
    </td>
  </tr>
  ```
- Para el caso de `ProjectRow` (proyectos sin agrupación, línea 1289+), agregar la misma fila extra cuando aplica.
- **No mostrar** en la línea madre (`GroupHeaderRow`).

Componente nuevo `src/components/proyectos/HitosEjecucionPanel.tsx`:

- Wrapper `<Collapsible defaultOpen={false}>` con trigger "Hitos Ejecución (N completados / M)".
- Contenido: tabla render desde la plantilla + valores existentes.
- Cada celda editable in-place (input texto o `<Select>` según tipo de columna), con autoguardado debounced 600 ms (mutación upsert sobre `hitos_proyecto_empresa_values`).
- Botón "Agregar fila" al pie → crea registro en `hitos_proyecto_empresa_extra_rows`.
- Recompute UI tras `await invalidateQueries` (regla de proyecto sobre mutaciones).

Hook nuevo: `src/hooks/useHitosProyectoEmpresa.ts` para valores y filas extra por `proyecto_empresa_id`.

---

### 5. Detección de "Obra/Ejecución"

El campo `proyectos.estado_obra` es un `select` cuyas opciones se enumeran en `Proyectos.tsx`/`ProyectoFormDialog.tsx`. Agregar la opción **"Obra/Ejecución"** al array de opciones del select (entre "Constructora Adjudicada" y "Obra Gruesa Inicial") en ambos archivos para que el admin pueda asignarla. La condición de visibilidad del panel será `estado_obra === "Obra/Ejecución"`.

---

### 6. Memoria

Guardar memoria nueva `mem://features/proyectos/hitos-ejecucion`:
- Plantilla global administrada en `/hitos-ejecucion`.
- Panel colapsado por empresa visible solo cuando `estado_obra = "Obra/Ejecución"`.
- Nunca aparece en la línea madre.
- Columnas tipo `texto` o `select` con opciones gestionables.

---

### Detalles técnicos
- Validación: nombre de columna no vacío y único (validación cliente).
- `Collapsible` ya existe en `src/components/ui/collapsible.tsx`.
- Mutaciones siguen `await invalidateQueries` antes de cerrar (regla del proyecto).
- Sin migración de datos retroactiva: sólo se ofrece la plantilla; los valores nacen vacíos por proyecto-empresa.
- TanStack Query keys: `["hitos-template"]`, `["hitos-values", proyectoEmpresaId]`.

