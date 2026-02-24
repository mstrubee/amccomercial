

## Correcciones: Completar alerta con delegacion + Scroll en formulario

### Problema 1: La alerta no se marca como completada al usar "Completar y crear nueva"

**Causa raiz**: En `handleSubmit` de `Alertas.tsx` (linea 280), cuando hay un `pendingCompleteId`, se disparan dos mutaciones casi simultaneamente:

1. `toggleCompletada.mutate(...)` - marca la alerta como completada
2. `createAlerta.mutate(...)` - crea la nueva alerta dependiente

El problema es que `createAlerta` puede resolverse antes que `toggleCompletada` termine de escribir en la base de datos. Cuando `createAlerta.onSuccess` se ejecuta, invalida la query `["alertas"]` y se refetch con el estado anterior (la alerta aun no completada en la BD). Esto sobreescribe el resultado de `toggleCompletada`.

Adicionalmente, cuando el usuario actua por delegacion, el `toggleCompletada` en `handleSubmit` no pasa el parametro `on_behalf_of`, perdiendo la trazabilidad.

**Solucion**: Cambiar `handleSubmit` para que la completacion se haga de forma secuencial: primero completar la alerta (con `await` usando `mutateAsync`), luego crear la nueva. Tambien pasar `on_behalf_of` cuando corresponda.

**Archivo**: `src/pages/Alertas.tsx` - funcion `handleSubmit` (linea 280-291)

Cambiar de:
```typescript
const handleSubmit = (data: AlertaInput & {id?: string;}) => {
  if (data.empresa_id === "none") data.empresa_id = null;
  if (pendingCompleteId) {
    toggleCompletada.mutate({ id: pendingCompleteId, completada: true });
    setPendingCompleteId(null);
  }
  if (data.id) {
    updateAlerta.mutate(data as AlertaInput & {id: string;});
  } else {
    createAlerta.mutate(data);
  }
};
```

A:
```typescript
const handleSubmit = async (data: AlertaInput & {id?: string;}) => {
  if (data.empresa_id === "none") data.empresa_id = null;
  if (pendingCompleteId) {
    // Determine delegation info
    const alertaToComplete = alertas?.find(a => a.id === pendingCompleteId);
    let onBehalfOf: string | undefined;
    if (alertaToComplete && user && alertaToComplete.usuario_responsable_id !== user.id && !isAdmin) {
      const deleg = delegacionesActivas?.find(d => d.delegante_id === alertaToComplete.usuario_responsable_id);
      if (deleg) {
        const deleganteProfile = profiles?.find(p => p.user_id === deleg.delegante_id);
        onBehalfOf = deleganteProfile?.display_name || deleganteProfile?.email || "";
      }
    }
    await toggleCompletada.mutateAsync({
      id: pendingCompleteId,
      completada: true,
      on_behalf_of: onBehalfOf,
    });
    setPendingCompleteId(null);
  }
  if (data.id) {
    updateAlerta.mutate(data as AlertaInput & {id: string;});
  } else {
    createAlerta.mutate(data);
  }
};
```

---

### Problema 2: El scroll del formulario de edicion/creacion de alertas no funciona

**Causa raiz**: El `DialogContent` en `AlertaFormDialog.tsx` no tiene restriccion de altura maxima ni scroll. Cuando el formulario tiene muchos campos visibles (proyecto, empresa, categoria comercial, clasificacion, sub-clasificacion, texto, responsable, fecha), el contenido desborda sin scroll.

**Solucion**: Agregar `max-h-[85vh]` y `overflow-y-auto` al contenedor del formulario, manteniendo header y footer fijos.

**Archivo**: `src/components/alertas/AlertaFormDialog.tsx` - linea 154

Cambiar:
```html
<DialogContent className="sm:max-w-lg">
```
A:
```html
<DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
```

Y cambiar el div del formulario (linea 161):
```html
<div className="space-y-4 py-2">
```
A:
```html
<div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
```

---

### Resumen de archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/Alertas.tsx` | `handleSubmit`: usar `mutateAsync` para completar antes de crear; pasar `on_behalf_of` en delegacion |
| `src/components/alertas/AlertaFormDialog.tsx` | Agregar scroll al formulario con `max-h-[85vh]`, `overflow-y-auto`, `flex flex-col` |

