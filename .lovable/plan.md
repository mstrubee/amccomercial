

# Intercambiar posición de badges: Estado AMC → fila hija, Estatus → fila madre

## Situación actual
- **Fila madre (parent row)**: Muestra el badge de `estado_amc` con popover para cambiar (columna "Estado (x Proyecto)")
- **Fila hija (child row)**: Muestra el botón de Estatus (boton_label de categorias_proyecto/subcategorias_proyecto)

## Cambio solicitado
- **Fila madre**: Mostrar los badges de **Estatus (x Empresa)** — un resumen de los boton_label de las empresas hijas
- **Fila hija**: Mostrar el badge de **Estado AMC** con popover editable para cambiar el estado por empresa

## Problema técnico
El campo `estado_amc` está en la tabla `proyectos`, no en `proyecto_empresas`. Para que cada empresa hija tenga su propio Estado AMC, se necesita una migración para agregar `estado_amc` a la tabla `proyecto_empresas`.

## Plan de implementación

### 1. Migración de base de datos
- Agregar columna `estado_amc` (text, default 'Vigente') a `proyecto_empresas`
- Migrar los valores existentes: copiar `proyectos.estado_amc` a todos los `proyecto_empresas` vinculados

### 2. Modificar fila madre (parent row) — `Proyectos.tsx` ~línea 754-778
- Reemplazar el popover de `estado_amc` por un resumen de Estatus (boton_labels) de las empresas hijas
- Mostrar los badges coloreados de cada empresa agrupada (similar a lo que hoy se ve en las filas hijas)

### 3. Modificar fila hija (child row) — `Proyectos.tsx` ~línea 907-921
- Reemplazar el boton_label de Estatus por el badge de Estado AMC con popover editable
- El popover actualiza `proyecto_empresas.estado_amc` en vez de `proyectos.estado_amc`
- Actualizar `handleUpdateEstadoAmc` para que opere sobre `proyecto_empresas` en lugar de `proyectos`

### 4. Modificar ProjectRow (proyecto sin grupo) — `Proyectos.tsx` ~línea 1324-1346
- Mostrar ambos: el Estatus y el Estado AMC en las columnas correspondientes

### 5. Actualizar filtros
- **Filtro "Estado AMC (x Empresa)"** (#5): Actualmente usa `filterBotones` que filtra por boton_label — corregir para que filtre por `proyecto_empresas.estado_amc`
- **Filtro "Estatus (x Empresa)"** (#6): Ya filtra por categorias — mantener igual
- La columna header "Estado (x Proyecto)" se mantiene, pero lo que muestra cambia según fila madre vs fila hija

### 6. Actualizar la query de proyectos
- En `useProyectos.ts`, incluir el nuevo campo `estado_amc` de `proyecto_empresas` en el select

### 7. Vista de detalle — ~línea 1581-1584
- Ajustar el `StatusBadge` en el diálogo de vista para reflejar los estados AMC por empresa

## Archivos a modificar
- **Migración SQL** — nueva columna en `proyecto_empresas`
- `src/pages/Proyectos.tsx` — intercambiar badges, actualizar handler, corregir filtro
- `src/hooks/useProyectos.ts` — ajustar query y tipos si necesario
- `src/hooks/useEstadosAmc.ts` — sin cambios (ya funciona)

