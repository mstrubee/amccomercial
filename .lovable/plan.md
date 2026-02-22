
# Auto-clasificar la nueva alerta como el paso siguiente

## Objetivo
Cuando se completa una alerta y se elige "Completar y crear nueva", la nueva alerta debe pre-seleccionar automaticamente la siguiente clasificacion/sub-clasificacion en la secuencia logica. El usuario podra editarla antes de confirmar.

## Secuencia actual de clasificaciones

```text
Proyectos (orden 1)
  1. Ofrecer para cotizar
  2. Ofrecido para Cotizar
  3. Chequear Estado Obra
  4. Pedir Planos
  5. Planos Pedidos
  6. Cotizar / Solicitar Presupuesto
  7. Seguimiento Presupuesto Empresa
  8. Seguimiento Presupuesto Cliente  <-- ultima

Obras / Ejecucion (orden 2)
  (sin sub-clasificaciones aun)

Finanzas (orden 3)
  (sin sub-clasificaciones aun)
```

## Logica del "paso siguiente"

1. Si la alerta tiene sub-clasificacion y hay una sub-clasificacion siguiente (mismo padre, orden mayor), se selecciona esa.
2. Si la alerta tiene sub-clasificacion y es la ultima de su grupo, se pasa a la primera sub-clasificacion de la siguiente clasificacion. Si la siguiente clasificacion no tiene subs, se selecciona solo la clasificacion.
3. Si la alerta tiene clasificacion pero sin sub-clasificacion, se pasa a la primera sub de la siguiente clasificacion, o a la clasificacion siguiente si no tiene subs.
4. Si la alerta no tiene clasificacion, no se pre-selecciona nada.

Ejemplo concreto: "Seguimiento Presupuesto Cliente" (ultima sub de Proyectos) pasa a "Obras / Ejecucion" (clasificacion, sin sub).

## Cambios necesarios

### 1. AlertaFormDialog.tsx
- Agregar props opcionales `defaultClasificacionId` y `defaultSubclasificacionId`.
- En el `useEffect` de inicializacion (cuando no es edicion), usar estos valores como defaults para los campos de clasificacion y sub-clasificacion.

### 2. Funcion utilitaria `getNextClasificacion`
- Crear una funcion (dentro de `AlertaFormDialog.tsx` o como utilidad) que reciba la clasificacion/sub-clasificacion actual y la lista completa de clasificaciones, y retorne `{ clasificacionId, subclasificacionId }` del paso siguiente.

### 3. Alertas.tsx
- En `onCompleteAndCreate`: incluir `clasificacionId` y `subclasificacionId` de la alerta completada en `createDefaults`.
- Calcular el paso siguiente usando `getNextClasificacion` antes de pasarlo al `AlertaFormDialog`.
- Pasar los nuevos props `defaultClasificacionId` y `defaultSubclasificacionId`.

### 4. Proyectos.tsx
- Mismo cambio: en `onCompleteAndCreate`, incluir la clasificacion de la alerta en `alertaCreateContext`.
- Pasar los defaults calculados al `AlertaFormDialog`.

### 5. AlertaWidget.tsx
- Mismo patron: incluir la clasificacion en `createDefaults` y pasar los defaults de siguiente paso al formulario.

## Detalle tecnico

La funcion `getNextClasificacion` trabajara asi:

```text
Input:  clasificacionId, subclasificacionId, clasificaciones[]
Output: { clasificacionId, subclasificacionId }

1. Encontrar la clasificacion actual en la lista ordenada
2. Si hay subclasificacion actual:
   a. Buscar la siguiente sub (orden mayor, mismo padre)
   b. Si existe -> retornar misma clasificacion + siguiente sub
   c. Si no existe -> buscar siguiente clasificacion en la lista global
      - Si tiene subs -> retornar primera sub de esa clasificacion
      - Si no tiene subs -> retornar solo la clasificacion
3. Si no hay subclasificacion:
   - Buscar siguiente clasificacion en la lista global (mismo patron)
4. Si no hay clasificacion -> retornar vacio (sin default)
```

Los 3 archivos padres pasaran la clasificacion de la alerta completada al `createDefaults`, y calcularan el "next" antes de pasarlo como prop al formulario. El calculo se hace en cada archivo usando la data de `useClasificacionesAlerta()` que ya se importa o se puede importar.
