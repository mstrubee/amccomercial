## Problema

En el popover de `ClientePicker` (dentro de la sección **Contactos** del editor de proyecto) se ven clientes repetidos: el mismo nombre aparece varias veces porque existen filas duplicadas en `clientes` (mismo `nombre`, distinto `id`), cada una con su propio contacto.

Verificado en BD: hay clientes con 2–5 filas duplicadas por nombre (`ANF arquitectos` x5, `Estudio Valdes` x4, `GVAA` x3, etc.).

## Solución (solo UI)

Deduplicar la lista del dropdown y la lógica de selección de cliente, agrupando por nombre normalizado y **fusionando** sus `contactos_cliente`. Sin tocar la base de datos.

### Cambios en `src/components/proyectos/ProyectoFormDialog.tsx`

1. **`ClientePicker`**
   - Antes de filtrar, construir `dedupedClientes` a partir de `clientes`:
     - Clave = `nombre.trim().toLowerCase()`.
     - Para cada grupo, conservar el primer registro como base y fusionar los `contactos_cliente` de todos los duplicados (eliminando contactos idénticos por `contacto + email + telefono`).
   - Usar `dedupedClientes` en `filtered` y en el `.map()` del listado.
   - El `onSelect` sigue pasando el cliente fusionado (mantiene `id` del primero, lo cual es suficiente para `categoria_id` y para la búsqueda por `nombre`).

2. **`ContactosSection` → `getClientesForCategory` / `applyCliente` / `handleContactoChange`**
   - Aplicar la misma deduplicación a la lista que se pasa como `availableClientes` al `ClientePicker` y a los lookups por `nombre`, para que los contactos disponibles del cliente seleccionado incluyan los de **todas** las filas duplicadas (no solo los de la primera fila encontrada).
   - Implementarlo con un helper local `dedupeClientesByNombre(clientes)` reutilizable.

### No se cambia

- Esquema, RLS, mutaciones ni hook `useClientes`.
- La limpieza de duplicados en BD queda como tarea aparte (lo pueden hacer desde **Clientes y Captadores**).

### Archivos

- `src/components/proyectos/ProyectoFormDialog.tsx` (único archivo).
