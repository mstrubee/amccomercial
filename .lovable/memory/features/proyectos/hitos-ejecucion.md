---
name: Hitos Ejecución Proyectos
description: Plantilla global de checklist administrable, visible bajo cada empresa cuando estado_obra = Obra/Ejecución
type: feature
---
- Sección Admin `/hitos-ejecucion` permite gestionar la plantilla global: columnas (texto o select con opciones) y filas predefinidas.
- Tablas: `hitos_template_columns`, `hitos_template_column_options`, `hitos_template_rows`, `hitos_proyecto_empresa_values`, `hitos_proyecto_empresa_extra_rows`.
- El panel `HitosEjecucionPanel` se muestra **colapsado** bajo cada línea de empresa (child row, NUNCA en línea madre) cuando `proyectos.estado_obra === "Obra/Ejecución"`.
- Cada empresa puede agregar filas extra propias sin afectar la plantilla.
- Autoguardado debounced 600ms en celdas de texto; selects guardan al instante.
- Estado "Obra/Ejecución" insertado entre "Constructora Adjudicada" y "Obra Gruesa Inicial" en ESTADOS_OBRA y ProyectoFormDialog.
