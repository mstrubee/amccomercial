

## Fix: Sticky header en listado de Proyectos

### Causa del problema

El contenedor de la pagina Proyectos usa `h-full flex flex-col overflow-hidden`, pero el elemento padre en `AppLayout.tsx` es:

```
<main className="flex-1 overflow-auto">
  <div className="p-8">{children}</div>   <!-- no tiene altura definida -->
</main>
```

Como `<div className="p-8">` no tiene altura fija ni `h-full`, el `h-full` de Proyectos no tiene referencia de altura y no restringe el contenedor. Esto hace que todo el contenido crezca libremente y el scroll lo maneja `<main>`, anulando el `sticky` del `thead`.

### Solucion

Dos cambios minimos:

**1. `src/components/layout/AppLayout.tsx`** (linea 190-191)

Cambiar:
```html
<main className="flex-1 overflow-auto">
  <div className="p-8">{children}</div>
</main>
```
Por:
```html
<main className="flex-1 overflow-hidden">
  <div className="p-8 h-full overflow-auto">{children}</div>
</main>
```

Esto hace que el div interior tenga una altura definida (100% de main) y sea el que haga scroll. Todas las paginas siguen funcionando igual porque el scroll pasa del `<main>` al `<div>`.

**2. `src/pages/Proyectos.tsx`** (linea 324)

Cambiar `h-full` por `h-full overflow-hidden` (mantener, ya lo tiene). Ademas agregar `overflow-hidden` al div padre para que Proyectos controle su propio scroll interno y no el del layout:

```html
<div className="h-full flex flex-col overflow-hidden gap-4">
```

Esto ya esta correcto. Solo el cambio en AppLayout es necesario. Con `h-full` en el wrapper del layout, la cadena de alturas queda: `main (flex-1)` -> `div (h-full)` -> Proyectos `(h-full)`, y el sticky del thead funciona dentro del scroll interno de la tabla.

### Archivo a modificar

- `src/components/layout/AppLayout.tsx` - Lineas 190-191: cambiar clases de main y su div hijo

