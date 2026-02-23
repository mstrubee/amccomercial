

## Recordar la categoria comercial avanzada al crear nueva alerta

### Problema

Cuando el usuario completa una alerta y elige avanzar la categoria comercial (por ejemplo, de "Contactado" a "Planos Recibidos"), esa seleccion no se transmite al formulario de la nueva alerta. El formulario recibe la categoria **antigua** de la alerta original en lugar de la categoria **avanzada** que el usuario selecciono.

Esto sucede porque `onCompleteAndCreate` recibe solo el objeto de alerta original, y tanto `Alertas.tsx` como `AlertaWidget.tsx` leen `alerta.categoria_proyecto_id` (el valor viejo) para pasarlo como default al formulario.

### Solucion

Modificar la firma de `onCompleteAndCreate` en `CompleteAlertaDialog` para que incluya la categoria avanzada seleccionada por el usuario. Luego actualizar los consumidores (`Alertas.tsx` y `AlertaWidget.tsx`) para usar esa categoria en lugar de la original.

### Cambios tecnicos

**1. `src/components/alertas/CompleteAlertaDialog.tsx`**

- Cambiar la firma de `onCompleteAndCreate` de `(alerta: AlertaWithRelations)` a `(alerta: AlertaWithRelations, advancedCat?: { categoriaId: string; subcategoriaId: string | null })`.
- En el boton "Completar y crear nueva", calcular la categoria avanzada a partir de `selectedCatValue` y `advanceEnabled`, y pasarla como segundo argumento.

**2. `src/pages/Alertas.tsx`**

- Actualizar el handler `onCompleteAndCreate` para recibir el segundo parametro `advancedCat`.
- Si `advancedCat` existe, usar esos valores para `categoriaProyectoId` y `subcategoriaProyectoId` en `setCreateDefaults` en lugar de leer los campos de la alerta original.

**3. `src/components/alertas/AlertaWidget.tsx`**

- Aplicar el mismo cambio: recibir `advancedCat` en el handler `onCompleteAndCreate` y usarlo para `defaultCategoriaProyectoId` y `defaultSubcategoriaProyectoId` en `setCreateDefaults`.

