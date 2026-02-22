
# Revertir alerta al cancelar creacion de seguimiento

## Problema actual
Cuando el usuario elige "Completar y crear nueva", la alerta se marca como completada inmediatamente. Si luego cancela la creacion de la nueva alerta, la original queda completada sin seguimiento, lo cual no es el comportamiento deseado.

## Solucion
Diferir la marcacion como completada: en lugar de completar la alerta al hacer clic en "Completar y crear nueva", solo abrir el formulario de creacion. La alerta original se marcara como completada unicamente cuando el usuario confirme la creacion de la nueva alerta.

## Cambios necesarios

### 1. Alertas.tsx (pagina principal)
- En `onCompleteAndCreate`: NO llamar `toggleCompletada.mutate()`. Solo guardar el contexto (proyecto, empresa, parent) y abrir el dialog de creacion.
- Agregar un estado `pendingCompleteId` para recordar que alerta debe completarse.
- En el `onSubmit` del `AlertaFormDialog`: primero completar la alerta pendiente, luego crear la nueva.
- En el `onClose` del `AlertaFormDialog`: si hay un `pendingCompleteId` y se cierra sin crear, limpiar el estado sin completar nada.

### 2. Proyectos.tsx
- Mismo patron: diferir `toggleCompletada` hasta que se confirme la creacion en el formulario.
- Agregar `pendingCompleteId` y completar solo al hacer submit.

### 3. AlertaWidget.tsx
- Mismo patron: diferir la completacion hasta el submit del formulario de creacion.
- Al cancelar/cerrar el dialog de creacion, no completar la alerta.

### Detalle tecnico

En cada uno de los 3 archivos, el cambio sigue esta logica:

```text
ANTES:
  onCompleteAndCreate -> completar alerta + abrir form
  form.onClose -> cerrar form
  form.onSubmit -> crear nueva alerta

DESPUES:
  onCompleteAndCreate -> guardar id pendiente + abrir form (sin completar)
  form.onClose -> limpiar pendiente (alerta NO se completa)
  form.onSubmit -> completar alerta pendiente + crear nueva alerta
```

No se requieren cambios en la base de datos ni en `CompleteAlertaDialog.tsx`.
