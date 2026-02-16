

## Problema

Al escribir notas, cada autoguardado (cada 800ms) dispara una invalidacion completa de la query `["proyectos"]`, lo que provoca:

1. Se re-descarga toda la tabla de proyectos desde la base de datos
2. El componente se re-renderiza con los datos nuevos
3. El `useEffect` que sincroniza `proyecto.notas` sobreescribe el texto local del textarea
4. El usuario pierde lo que estaba escribiendo o ve comportamiento erratico

## Solucion

Eliminar la invalidacion de queries en el autoguardado de notas, y en su lugar usar actualizacion optimista local. Solo sincronizar desde el servidor cuando el usuario no esta escribiendo.

### Cambios en `src/hooks/useProyectos.ts`

**`useUpdateNotas` y `useUpdateNotaGrupo`**: Reemplazar `queryClient.invalidateQueries` en `onSuccess` por una actualizacion optimista usando `queryClient.setQueryData`. Esto actualiza el cache local sin re-descargar datos, evitando el re-render destructivo.

```
onSuccess: (_data, variables) => {
  qc.setQueryData(["proyectos"], (old) => {
    // actualizar solo el campo notas del proyecto correspondiente
  });
}
```

### Cambios en `src/pages/Proyectos.tsx`

**`NotasCell` y `NotaGrupoCell`**: 

1. Agregar un ref `isFocusedRef` para rastrear si el textarea tiene foco
2. Modificar el `useEffect` de sincronizacion para que NO actualice el estado local mientras el usuario esta escribiendo (cuando el textarea tiene foco)
3. Esto previene que datos del servidor sobreescriban lo que el usuario esta tipeando

```
const isFocusedRef = useRef(false);

useEffect(() => {
  if (!isFocusedRef.current) {
    setValue((proyecto as any).notas || "");
  }
}, [(proyecto as any).notas]);
```

### Detalle tecnico

| Componente | Cambio | Razon |
|---|---|---|
| `useUpdateNotas` | `setQueryData` en vez de `invalidateQueries` | Evita refetch completo |
| `useUpdateNotaGrupo` | `setQueryData` en vez de `invalidateQueries` | Evita refetch completo |
| `NotasCell` | Guard con `isFocusedRef` en useEffect | No sobreescribir texto durante escritura |
| `NotaGrupoCell` | Guard con `isFocusedRef` en useEffect | No sobreescribir texto durante escritura |

