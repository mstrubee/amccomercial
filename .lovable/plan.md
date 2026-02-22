

## Plan: Botones personalizados en categorias y subcategorias

### Resumen

Agregar la posibilidad de configurar un "boton" visual en cada categoria y subcategoria desde la seccion Categorias. Este boton se mostrara en las lineas hijas de la tabla de Proyectos, en una nueva columna dedicada.

---

### 1. Migracion de base de datos

Agregar 3 columnas nullable a **ambas** tablas:

**`categorias_proyecto`:**
- `boton_label` (text, nullable, default null)
- `boton_bg_color` (text, nullable, default null)
- `boton_text_color` (text, nullable, default null)

**`subcategorias_proyecto`:**
- `boton_label` (text, nullable, default null)
- `boton_bg_color` (text, nullable, default null)
- `boton_text_color` (text, nullable, default null)

No se requieren nuevas politicas RLS (las existentes ya cubren lectura/escritura).

---

### 2. Hooks de categorias (`src/hooks/useCategorias.ts`)

- Agregar los 3 campos de boton a los tipos `useUpdateCategoria` y `useUpdateSubcategoria`
- Incluirlos en las mutaciones de update

---

### 3. Formulario de edicion en CategoriasManagerDialog

**En el formulario de edicion de categoria** (cuando `editingCat` esta activo):
- Agregar seccion "Boton personalizado" con:
  - Input para el nombre/label del boton
  - Selector de color de fondo
  - Selector de color de texto
  - Preview del boton con los estilos aplicados
  - Boton para eliminar la configuracion del boton (poner los 3 campos en null)
- Si no hay boton configurado, mostrar un enlace "Agregar Boton" que expande los campos

**Idem para el formulario de edicion de subcategoria.**

Los campos de boton se envian junto con el resto de datos al guardar.

---

### 4. Nueva columna en la tabla de Proyectos

**`src/pages/Proyectos.tsx`:**
- Agregar una columna con header vacio (o "Accion") en el `<thead>` de la tabla, antes de la columna "Acciones"
- En las **lineas hijas** (child rows, donde se renderiza cada empresa): mostrar el boton configurado si la subcategoria o categoria de esa empresa tiene un boton definido
  - Prioridad: si la subcategoria tiene boton, usar ese; si no, usar el de la categoria padre
  - Si ninguno tiene boton, la celda queda vacia
- El boton se renderiza con los estilos personalizados (`backgroundColor`, `color`) y el label configurado
- En las filas agrupadas (header de grupo) y filas individuales no se muestra boton (celda vacia)

---

### Seccion tecnica

- La logica de resolucion del boton en child rows usa los datos de `categorias_proyecto` y `subcategorias_proyecto` que ya vienen cargados via `useCategorias()`
- Se cruza `pe.subcategoria_id` y `pe.categoria_id` contra el listado de categorias para encontrar la configuracion de boton
- El boton es puramente visual por ahora (no tiene accion al hacer click), pero queda preparado para agregar funcionalidad futura
- Los campos `boton_*` son nullable: cuando son null significa "sin boton configurado"

