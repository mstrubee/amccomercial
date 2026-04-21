---
name: Hitos Ejecución Proyectos
description: Plantilla global de checklist administrable, visible bajo cada empresa cuando estado_obra = Obra/Ejecución
type: feature
---
- Sección Admin `/hitos-ejecucion` permite gestionar la plantilla global: columnas (texto o select con opciones) y filas predefinidas.
- Las columnas son TIPO/fijas: solo se gestionan en Admin, NO se pueden agregar desde un proyecto.
- Tipos de columna soportados: `texto`, `select` (con opciones), `fecha` (datepicker), `checkbox` (con configuración `checkbox_action`: `fijar_fecha_y_completar` | `solo_fecha` | `solo_completar` y `checkbox_color` para pintar la celda al completar).
- El valor de celdas tipo `checkbox` se guarda como JSON `{checked, fecha?}` en `valor`. El de `fecha` como `YYYY-MM-DD`.
- Las filas TIPO tienen contenido editable por celda en Admin (`hitos_template_row_defaults`); estos valores se cargan como defaults en cualquier proyecto y son sobrescribibles por empresa.
- Tablas: `hitos_template_columns`, `hitos_template_column_options`, `hitos_template_rows`, `hitos_template_row_defaults`, `hitos_proyecto_empresa_values`, `hitos_proyecto_empresa_extra_rows`.
- El panel `HitosEjecucionPanel` se muestra **colapsado** bajo cada línea de empresa (child row, NUNCA en línea madre) cuando `proyectos.estado_obra === "Obra/Ejecución"`.
- Cada empresa puede agregar filas extra propias sin afectar la plantilla. NUNCA columnas.
- Autoguardado debounced 600ms en celdas de texto; selects guardan al instante.
- Estado "Obra/Ejecución" insertado entre "Constructora Adjudicada" y "Obra Gruesa Inicial" en ESTADOS_OBRA y ProyectoFormDialog.
