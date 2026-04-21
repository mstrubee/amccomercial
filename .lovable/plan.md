

## Simplificar Excel de Hitos: ocultar metadatos y matchear selects por texto

### Objetivo
El Excel descargado debe ser amigable para el usuario: solo columnas con texto editable visibles. Las columnas técnicas (`__row_id`, `__parent_id`, `__orden`, `__numbering`) seguirán existiendo para reconciliar al cargar, pero estarán **ocultas**. Además, en columnas tipo `select`, si el usuario escribe texto, el sistema buscará la opción que coincida; si no hay match, la celda quedará vacía.

### Cambios en `src/lib/hitos-excel.ts`

**1. Export — ocultar columnas técnicas**

- Mantener las columnas meta (`__row_id`, `__parent_id`, `__orden`, `__numbering`) en el archivo (necesarias para reconciliar al reimportar).
- Ocultarlas vía propiedad `hidden: true` en `ws["!cols"]` para cada índice meta.
- Reducir su `wch` a 0 como respaldo visual.
- Mantener la hoja `_columnas` también oculta usando `ws["!Hidden"] = 1` (estado de hoja oculta en SheetJS) para no distraer al usuario.
- La columna visible `#` (numeración jerárquica 1.2.3) se mantiene visible como referencia de lectura.

**2. Export — columna select**

- Para cada columna `tipo === "select"`, agregar Data Validation nativa de Excel (lista desplegable) con las opciones del template, para que el usuario tenga el desplegable en Excel y no necesite tipearlo.
- Esto se hace con `ws["!dataValidation"]` (SheetJS Pro) — como SheetJS community no soporta data validation, usaremos una alternativa: agregar las opciones válidas como nota en el header (ej. `Estado [select: Pendiente|En curso|Listo]`) para guiar al usuario.

**3. Import — matching tolerante para `select`**

Nueva función `parseImportedCell` para `tipo === "select"`:
- Tomar el valor ingresado por el usuario (string).
- Normalizar (trim, lowercase, sin acentos).
- Buscar coincidencia exacta normalizada contra las opciones de la columna (`column.options[].valor`).
- Si coincide → guardar el `valor` exacto de la opción (preservando mayúsculas/acentos originales).
- Si NO coincide → retornar `""` (celda vacía, el usuario completará en el sistema).

Para esto, `parseImportedCell` necesita acceso a la columna completa (no solo `tipo`). Cambiar firma a `(column: HitosColumn, value, currentRaw)`.

**4. Import — tolerancia a header faltante**

- Si `__row_id` no está presente (porque el usuario abrió un Excel viejo o lo borró), tratar todas las filas como nuevas en orden de aparición, agrupando bajo el padre por columna `#` (numeración jerárquica) si está disponible. Esto agrega resiliencia.
- Mostrar advertencia (no error) en la UI vía `summary.errors.push("Aviso: archivo sin metadatos; se recreó la jerarquía desde la columna #")`.

### Cambios en `src/pages/HitosEjecucionPage.tsx`

- Sin cambios funcionales; ya usa el helper. Solo verificar que el toast de import muestre adecuadamente el campo `errors` como avisos cuando aplica.

### Resumen visual

```text
Excel descargado (lo que ve el usuario):
┌─────┬─────────────┬──────────────────┬──────────────┐
│  #  │ Nombre [..] │ Estado [select:..│ Fecha [fecha]│
├─────┼─────────────┼──────────────────┼──────────────┤
│ 1   │ Etapa A     │ Pendiente        │ 2025-01-15   │
│ 1.1 │ Subitem     │                  │              │
└─────┴─────────────┴──────────────────┴──────────────┘
(columnas __row_id, __parent_id, __orden, __numbering: ocultas)
(hoja _columnas: oculta)
```

### Detalles técnicos

- **Hidden columns en SheetJS**: `ws["!cols"][i] = { hidden: true, wch: 0 }`.
- **Hidden sheet**: `wb.Workbook = { Sheets: [{ name: "Plantilla", Hidden: 0 }, { name: "_columnas", Hidden: 1 }] }`.
- **Normalización para match select**: `s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()`.
- **Header select con hint**: `${nombre} [select: opt1 | opt2 | opt3]` — el parser de import seguirá reconociendo por prefijo `${nombre} [select`.

### Archivos a modificar
- `src/lib/hitos-excel.ts` (export con columnas ocultas + import con matching tolerante para select)

