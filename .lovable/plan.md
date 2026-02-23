

## Renombrar etiquetas en todo el sistema

### Resumen de cambios

Se renombraran las siguientes etiquetas UI en todos los archivos donde aparezcan como texto visible al usuario:

| Nombre actual | Nuevo nombre |
|---|---|
| Estado AMC (como encabezado/titulo) | Estado (x Proyecto) |
| Clasificación (de proyecto, no de alerta) | Tipo de Proyecto |
| Seguimiento (como etiqueta KPI) | Estado AMC (x Empresa) |
| Categoría / Categorías (comerciales, de empresa) | Estatus (x Empresa) |
| Estatus (menu admin) | Estatus (x Empresa) |

**Nota importante:** La "Clasificación" en la seccion de Alertas (boton "Clasificación" y "Clasificación Alerta") NO se renombra, ya que es un concepto diferente (clasificacion de alertas, no de proyectos). Tampoco se renombra "Categoría" en el contexto de Clientes (es la categoria del cliente, no del proyecto).

### Archivos a modificar

#### 1. `src/pages/Proyectos.tsx`
- Encabezado de columna "Estado AMC" -> "Estado (x Proyecto)" (linea 606)
- Subtitulo KPI "Seguimiento" -> "Estado AMC (x Empresa)" (linea 564)

#### 2. `src/pages/Dashboard.tsx`
- Titulo de grafico "Proyectos por Estado AMC" -> "Proyectos por Estado (x Proyecto)" (linea 239)
- Encabezado de columna "Estado AMC" -> "Estado (x Proyecto)" (linea 356)
- Comentarios internos con "Estado AMC" (lineas 96, 231)

#### 3. `src/components/proyectos/ProyectoFormDialog.tsx`
- Label "Clasificación" -> "Tipo de Proyecto" (linea 436)
- Placeholder "Sin clasificación" -> "Sin tipo" (linea 442)
- Label "Estado AMC" -> "Estado (x Proyecto)" (linea 470)
- Boton "Categorías" -> "Estatus (x Empresa)" (linea 492)
- Texto "Elegir Categoría" -> "Elegir Estatus" (linea 1196)

#### 4. `src/components/proyectos/CategoriasManagerDialog.tsx`
- Titulo dialog "Administrar Categorías" -> "Administrar Estatus (x Empresa)" (linea 186)
- Labels "Nueva categoría" -> "Nuevo estatus" (linea 371)
- Labels "Nueva subcategoría" -> "Nuevo sub-estatus" (linea 339)
- Tooltips "Convertir en subcategoría" / "Promover a categoría" actualizados
- Boton "Agregar subcategoría" -> "Agregar sub-estatus" (linea 361)

#### 5. `src/pages/CategoriasPage.tsx`
- Titulo "Categorías Comerciales" -> "Estatus (x Empresa)" (linea 10)
- Subtitulo actualizado (linea 11)
- Texto boton "Abrir administrador de categorías" -> "Abrir administrador de estatus" (linea 17)

#### 6. `src/components/layout/AppLayout.tsx`
- Item menu admin "Estatus" -> "Estatus (x Empresa)" (linea 47)

#### 7. `src/pages/CargaMasiva.tsx`
- Columnas de plantilla Excel: "Clasificación" -> "Tipo de Proyecto", "Estado AMC" -> "Estado (x Proyecto)", "Categoría Empresa X" -> "Estatus Empresa X"
- Encabezados de tabla de preview (lineas 1608, 1610)
- Encabezados de hoja de referencia (linea 245)
- Mensajes de error de validacion
- Etiqueta AI "1/3 Clasificación" -> "1/3 Tipo de Proyecto" (linea 1349)
- Todas las referencias internas a las claves de datos del Excel deben actualizarse de forma consistente

#### 8. `src/pages/Alertas.tsx`
- Encabezado de columna "Estatus" ya esta correcto, no requiere cambio

### Archivos que NO se modifican
- `src/pages/Clientes.tsx` - "Categoría" aqui se refiere a categorias de clientes, concepto diferente
- `src/pages/Alertas.tsx` boton "Clasificación" - se refiere a clasificacion de alertas, concepto diferente
- `src/components/alertas/ClasificacionesAlertaDialog.tsx` - concepto de alertas, no de proyectos
- Edge functions (`generate-titulos`, `parse-alertas`) - "Seguimiento" es un valor de dato de alertas, no una etiqueta UI
- Campos de base de datos (`estado_amc`, `clasificacion_id`, etc.) - no se renombran, solo las etiquetas visibles

