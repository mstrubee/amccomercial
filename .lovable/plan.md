## Problema

El panel del chat (FloatingChat) se renderiza como `absolute` dentro del sidebar `<aside>`. Como el sidebar tiene su propio contexto de apilamiento y el contenido principal lo cubre por la derecha, el panel del chat se ve "cortado" por la tabla/contenido de Proyectos cuando se abre.

## Solución

Renderizar el panel del chat mediante **React Portal** (`createPortal` a `document.body`) usando posicionamiento `fixed`, calculado a partir del `getBoundingClientRect()` del botón flotante (FAB). Así el panel flota por encima de todo (sidebar, tabla, alertas, etc.) sin verse interrumpido.

### Cambios en `src/components/mensajeria/FloatingChat.tsx`

1. Agregar un `ref` al botón FAB (`fabRef`) y un estado `fabRect` que se actualice al abrir el chat y en `resize`/`scroll` de la ventana.
2. Envolver el `<motion.div>` del panel (líneas 587–...) en `createPortal(..., document.body)`.
3. Cambiar las clases de posicionamiento:
   - Quitar `absolute`, `bottom-full mb-2 / top-full mt-2`, `left-0 / right-0`.
   - Usar `fixed z-[100]` y `style={{ position: 'fixed', left, top, width, height }}` calculado desde `fabRect` + `chatSize` + `isBottom`/`isLeft` (mismo criterio actual: si `isBottom` → top = `fabRect.top - chatSize.h - 8`; si `isLeft` → left alineado al FAB, si no → right alineado).
4. Mantener intactos el resize handle, el tamaño persistido, los handlers y toda la lógica interna del chat. Solo cambia el contenedor de posicionamiento.

### Detalles técnicos

- Z-index: `z-[100]` (por encima del sidebar y de la barra de alertas inferior).
- Recalcular `fabRect` en: `open === true` (efecto), `window resize`, `scroll` (passive listener), y al cambiar `side`.
- No tocar lógica de negocio ni hooks de datos: es un cambio puramente de presentación/layout.

### Archivos a modificar

- `src/components/mensajeria/FloatingChat.tsx` (único archivo).
