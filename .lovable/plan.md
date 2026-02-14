

# Confirmacion de carga + Persistencia de estado en Carga Masiva

## 1. Confirmacion antes de cargar proyectos

Agregar un dialogo de confirmacion (AlertDialog) cuando el usuario presiona "Cargar N Proyectos". El dialogo mostrara cuantos proyectos se van a cargar y pedira confirmacion explícita antes de proceder.

### Cambios en `src/pages/CargaMasiva.tsx`
- Importar componentes de AlertDialog
- Agregar estado `confirmOpen` para controlar el dialogo
- El boton "Cargar N Proyectos" ahora abre el dialogo en vez de ejecutar directamente `handleBulkInsert`
- El boton "Confirmar" dentro del dialogo ejecuta `handleBulkInsert`
- Texto del dialogo: "Esta a punto de cargar N proyectos. Esta accion no se puede deshacer. Desea continuar?"

## 2. Persistencia del estado al navegar

Actualmente, todo el estado de la carga masiva vive en `useState` local, por lo que se pierde al cambiar de seccion. La solucion es guardar el estado en `sessionStorage` y restaurarlo al volver.

### Cambios en `src/pages/CargaMasiva.tsx`

**Estado a persistir:**
- `parsedRows` (las filas procesadas con sus datos, alertas, errores)
- `uploaded` (si ya se cargo)
- `dropdownsMatched` (si ya se hizo el matching de dropdowns)
- `aiPhase` (fase actual del pipeline de IA)
- `openProjects` (proyectos expandidos en la tabla)

**Implementacion:**
- Usar `useEffect` para guardar en `sessionStorage` cada vez que cambie `parsedRows` o los flags de estado
- En la inicializacion del componente, verificar si hay estado guardado en `sessionStorage` y restaurarlo
- Limpiar `sessionStorage` cuando:
  - Se presiona "Cancelar"
  - La carga se completa exitosamente
  - Se sube un archivo nuevo (reemplaza el estado anterior)

**Clave de almacenamiento:** `carga-masiva-state`

**Estructura guardada:**
```text
{
  parsedRows: ParsedRow[],
  uploaded: boolean,
  dropdownsMatched: boolean,
  aiPhase: string,
  openProjects: Record<number, boolean>
}
```

### Flujo del usuario tras la correccion

```text
1. Usuario sube Excel -> se procesa con IA
2. Usuario navega a /proyectos para verificar
3. Usuario vuelve a /carga-masiva
4. El estado se restaura automaticamente desde sessionStorage
5. El usuario puede continuar editando o cargar los proyectos
```

## Archivos a modificar

- `src/pages/CargaMasiva.tsx` - Unico archivo afectado

