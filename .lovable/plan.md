

## Correccion: Alerta no se completa en flujo "Completar y crear nueva"

### Causa raiz

El problema NO es la condicion de carrera entre mutaciones (eso ya se corrigio con `mutateAsync`). El problema real es que `AlertaFormDialog` llama `onClose()` inmediatamente despues de `onSubmit()` sin esperar a que termine:

```
// AlertaFormDialog.tsx linea 131-149
const handleSubmit = () => {
  onSubmit({...data...});  // async, retorna Promise sin awaitar
  onClose();               // se ejecuta de inmediato
};
```

Y en `Alertas.tsx` linea 679, el `onClose` del dialog limpia `pendingCompleteId`:
```
onClose={() => { setDialogOpen(false); setEditTarget(null); setCreateDefaults({}); setPendingCompleteId(null); }}
```

Entonces cuando el `handleSubmit` async finalmente evalua `if (pendingCompleteId)`, este ya es `null` y nunca ejecuta la completacion.

### Solucion

Dos cambios minimos:

**1. `src/components/alertas/AlertaFormDialog.tsx` (linea 131)**

Cambiar `handleSubmit` para que espere a que `onSubmit` termine antes de cerrar:

```typescript
const handleSubmit = async () => {
  if (!proyectoId || !texto.trim() || !fechaSeguimiento) return;
  // ... construir data igual que antes ...
  await onSubmit({...data...});
  onClose();
};
```

Y actualizar el tipo de `onSubmit` en Props (linea 22):
```typescript
onSubmit: (data: AlertaInput & { id?: string }) => void | Promise<void>;
```

**2. `src/pages/Alertas.tsx` (linea 679)**

Mover `setPendingCompleteId(null)` fuera del `onClose` del dialog, ya que ahora se limpia dentro de `handleSubmit` (linea 297) despues del `await`:

```typescript
onClose={() => { setDialogOpen(false); setEditTarget(null); setCreateDefaults({}); }}
```

El `setPendingCompleteId(null)` ya existe en la linea 297 de `handleSubmit`, despues de la completacion exitosa. Para el caso donde el usuario cancela sin enviar, se limpia cuando se abre una nueva alerta o en el propio flujo.

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/alertas/AlertaFormDialog.tsx` | `handleSubmit` pasa a ser `async`, `onSubmit` type acepta `Promise<void>`, se usa `await onSubmit(...)` antes de `onClose()` |
| `src/pages/Alertas.tsx` | Quitar `setPendingCompleteId(null)` del `onClose` del dialog para evitar limpieza prematura |

