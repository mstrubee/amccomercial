
## Reordenar y renombrar filtros + scroll fijo en listado de Proyectos

### 1. Renombrar y reordenar botones de filtro

Orden actual: Estado AMC, Estado Obra, Empresa, Categoría, Clasificación, Seguimiento

Nuevo orden y nombres:

| # | Nombre actual | Nuevo nombre |
|---|--------------|-------------|
| 1 | Estado AMC | **Estado (x Proyecto)** |
| 2 | Clasificación | **Tipo de Proyecto** |
| 3 | Estado Obra | Estado Obra (sin cambio) |
| 4 | Empresa | Empresa (sin cambio) |
| 5 | Seguimiento | **Estado AMC (x Empresa)** |
| 6 | Categoría | **Estatus (x Empresa)** |

### 2. Scroll fijo (sticky header)

Hacer que el titulo de la pagina, las KPI cards, la barra de busqueda/filtros, y los encabezados de columna de la tabla se mantengan fijos mientras se hace scroll en el listado de proyectos.

Enfoque tecnico:
- Envolver el contenido de la pagina en un contenedor flex con altura completa (`h-full flex flex-col overflow-hidden`)
- La seccion superior (titulo, filtros, KPIs) sera estatica sin scroll
- La tabla tendra un contenedor con `overflow-y-auto flex-1` para que solo el cuerpo de la tabla haga scroll
- El `thead` de la tabla usara `sticky top-0 z-10` para que los nombres de columna queden fijos al hacer scroll dentro de la tabla

### Archivo a modificar

- `src/pages/Proyectos.tsx` - Reordenar los bloques de Popover de filtros, cambiar las etiquetas de texto, y ajustar la estructura de layout para scroll fijo.
