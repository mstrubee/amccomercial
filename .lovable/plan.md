

## Fix: Categoría Comercial no reconocida al completar alerta

### Problema

Al completar una alerta y elegir "Completar y crear nueva", el diálogo no muestra la categoría comercial actual ni sugiere la siguiente. Esto ocurre porque el diálogo busca la categoría exclusivamente en la tabla `proyecto_empresas`, pero la categoría puede estar almacenada directamente en la alerta (campos `categoria_proyecto_id` / `subcategoria_proyecto_id`) y no haberse sincronizado a `proyecto_empresas`.

### Solución

Modificar `CompleteAlertaDialog.tsx` para que use **ambas fuentes de datos** al determinar la categoría actual:

1. Primero intentar con los campos propios de la alerta (`categoria_proyecto_id`, `subcategoria_proyecto_id`)
2. Si no existen, usar como fallback el registro de `proyecto_empresas`

Esto garantiza que siempre se muestre la categoría actual correcta y que el motor de sugerencias (`getNextCategoriaComercial`) funcione para proponer el siguiente paso.

### Cambios técnicos

**Archivo: `src/components/alertas/CompleteAlertaDialog.tsx`**

- Modificar los `useMemo` de `currentCatInfo` y `suggested` para que prioricen los campos de la alerta (`alerta.categoria_proyecto_id`, `alerta.subcategoria_proyecto_id`) sobre los de `proyecto_empresas`.
- En el cálculo de `suggested`, usar la categoría efectiva (de la alerta o de proyecto_empresas) como punto de partida para `getNextCategoriaComercial`.
- Ajustar la condición `showCategorySection` para que no dependa exclusivamente de que `proyectoEmpresa` tenga datos, sino que también considere los campos de la alerta.
- Asegurar que la query a `proyecto_empresas` siga activa como fallback pero no sea bloqueante si la alerta ya tiene la categoría.

**Archivo: `src/pages/Alertas.tsx`** (y `AlertaWidget.tsx`)

- Al invocar `onCompleteAndCreate`, pasar también los campos de categoría comercial de la alerta completada como `createDefaults` para que el formulario de la nueva alerta herede la categoría avanzada.

