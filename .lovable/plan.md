
## Eliminar nombre de proyecto en sublíneas

**Cambio**: En el archivo `src/pages/Proyectos.tsx`, línea 246, la celda de la sublínea muestra el nombre del proyecto (`p.nombre`), que ya aparece en la línea madre. Se eliminará ese texto y se dejará la celda vacía o se aprovechará el espacio.

### Detalle técnico

En la línea 246 del archivo `src/pages/Proyectos.tsx`:

```tsx
// Antes:
<td className="px-5 py-3 font-medium text-card-foreground cursor-pointer hover:underline pl-10" onClick={() => setViewTarget(p)}>{p.nombre}</td>

// Después:
<td className="px-5 py-3 pl-10"></td>
```

Se elimina el nombre del proyecto, el cursor pointer y el hover:underline de esa celda, ya que sin contenido clickeable no tienen sentido. La celda se mantiene para preservar la alineación de columnas de la tabla.
