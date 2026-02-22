

## Resumen

El cambio anterior aplicó checkboxes de seleccion multiple en el lugar equivocado. Lo que se necesita es:

1. **Formulario de creacion/edicion de alertas** -- Volver a seleccion unica de clasificacion (un solo Select, no checkboxes).
2. **Filtro de clasificaciones en la Central de Alertas** -- Cambiar de Select unico a checkboxes multi-seleccion.

---

## Cambios

### 1. Revertir AlertaFormDialog a seleccion unica

En `src/components/alertas/AlertaFormDialog.tsx`:

- Eliminar el estado `selectedClasifs` (Set) y las funciones `toggleClasif` / `buildClasificaciones` / `encodeKey`.
- Restaurar dos estados simples: `clasificacionId` y `subclasificacionId`.
- Restaurar el UI con un Select para clasificacion y otro Select condicional para sub-clasificacion (como estaba antes del cambio).
- Al enviar, construir el array `clasificaciones` con un solo elemento basado en la seleccion unica.

### 2. Filtro multi-seleccion en Alertas.tsx

En `src/pages/Alertas.tsx`:

- Cambiar `filterClasificacion` de `string` a `Set<string>` para almacenar multiples selecciones.
- Reemplazar el `<Select>` de clasificaciones por un `<Popover>` con checkboxes (similar al patron usado en otros filtros del proyecto, como los de empresa o categoria en Proyectos).
- Cada clasificacion aparece como checkbox, con sub-clasificaciones indentadas debajo.
- Actualizar la logica de filtrado en `useMemo` para verificar si la alerta tiene alguna clasificacion que coincida con cualquiera de las seleccionadas.
- Mostrar un indicador del numero de clasificaciones seleccionadas en el boton del Popover.
- Actualizar `saveFiltersAndNavigate` y la restauracion de filtros para serializar/deserializar el Set correctamente.

---

## Detalles Tecnicos

- El hook `useAlertas.ts` y la tabla `alerta_clasificaciones` no requieren cambios -- siguen soportando multiples clasificaciones por alerta a nivel de datos, pero el formulario solo permite seleccionar una a la vez.
- El filtro usara la misma codificacion `c:id` / `s:id` para las keys del Set de filtros multiples.
- El patron de Popover con checkboxes seguira el mismo estilo usado en los filtros de proyectos (contenedor con scroll, max-h-[400px]).
