## Problemas

1. **Textarea de nueva nota angosto**: `MentionTextarea` envuelve el `<textarea>` en un `<div class="relative">` sin `flex-1`. Dentro del contenedor padre (`flex gap-1`), el wrapper colapsa al contenido y el textarea `w-full` queda mínimo. El `Input` original ocupaba todo el ancho disponible porque era un único elemento flex sin wrapper.

2. **Dropdown @ no aparece al editar línea**: Ya se reemplazó el `Input` por `MentionTextarea`, pero la lista no se ve porque el contenedor de la checklist tiene `max-h-[300px] overflow-y-auto` y el menú está posicionado `absolute` dentro de ese contenedor, por lo que queda recortado por el overflow.

## Cambios

### `src/components/mensajeria/MentionTextarea.tsx`
- Agregar prop opcional `wrapperClassName` para que el `<div class="relative">` externo pueda recibir `flex-1` (u otras clases de layout) sin afectar el textarea.
- Renderizar el menú desplegable con `createPortal` a `document.body`, posicionado en `fixed` usando `getBoundingClientRect()` del textarea, con `z-index` alto. Esto evita el clipping por contenedores con `overflow:auto` (tanto en el checklist como en cualquier diálogo). Recalcular posición al abrir, al hacer scroll o al cambiar el query.

### `src/components/empresas/EmpresaChecklistPanel.tsx`
- Input de nueva nota: pasar `wrapperClassName="flex-1"` al `MentionTextarea` para que recupere el ancho completo de la fila.
- Edición inline de una línea: pasar `wrapperClassName="flex-1"` al `MentionTextarea` de edición (y quitar el `<div className="flex-1">` extra), para que conserve el ancho y herede el comportamiento del menú vía portal.

## Detalles técnicos

- `wrapperClassName` se aplica al `<div class="relative">`; `className` sigue aplicándose al `<textarea>` (no se rompe ningún uso existente: los demás callsites de `MentionTextarea` no usan la nueva prop).
- El portal del menú usa `position: fixed`, `top = rect.bottom + 4`, `left = rect.left`, ancho `w-64`, con `z-50` o superior. Listener `scroll` (capture) + `resize` mientras el menú esté abierto para reposicionar.
- No se modifica la lógica de detección de `@`, filtrado, navegación con teclado, ni selección con Enter/Space — la operatividad queda idéntica a la del input de creación.
