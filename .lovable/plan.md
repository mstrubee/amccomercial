

# Complementar información de contactos bidireccionalmente

## Problema actual
La auto-completación actual solo funciona en una dirección: si el proyecto tiene un campo vacío y el cliente lo tiene, se rellena el campo del proyecto. Pero si el **cliente** tiene campos vacíos que **sí existen en el proyecto**, esos no se actualizan en el cliente. Además, solo se ejecuta al abrir el formulario del proyecto, no al abrir el detalle del cliente.

## Solución

### 1. Al abrir el formulario del proyecto: complementar en ambas direcciones
**Archivo: `src/components/proyectos/ProyectoFormDialog.tsx` (ContactosSection)**

- El `useEffect` actual ya rellena campos vacíos del proyecto desde el cliente
- Agregar lógica inversa: si el proyecto tiene datos que el cliente NO tiene, actualizar el cliente automáticamente (vía `syncProyectoToClientes`)
- Ejemplo: si el proyecto tiene teléfono pero el cliente no, actualizar el registro del cliente con ese teléfono

### 2. Al abrir el detalle de un cliente: complementar desde proyectos vinculados
**Archivo: `src/components/clientes/ClienteDetailDialog.tsx`**

- Agregar un `useEffect` que al abrir el diálogo, revise los proyectos vinculados
- Si algún campo del cliente está vacío pero el proyecto lo tiene, rellenar el formulario del cliente con esos datos
- Marcar `hasChanges` para que el usuario pueda guardar los cambios detectados

### 3. Mejorar la función de merge en `useSyncClienteProyecto.ts`
**Archivo: `src/hooks/useSyncClienteProyecto.ts`**

- Agregar nueva función `complementClienteFromProyectos`: consulta proyectos vinculados y complementa campos vacíos del cliente
- Agregar nueva función `complementProyectoFromClientes`: complementa campos vacíos del proyecto desde el cliente (refactorizar la lógica existente del useEffect)
- Ambas funciones solo rellenan campos **vacíos**, nunca sobreescriben datos existentes

## Archivos a modificar
- `src/hooks/useSyncClienteProyecto.ts` — agregar funciones de complemento bidireccional
- `src/components/proyectos/ProyectoFormDialog.tsx` — al detectar cliente vinculado, también actualizar el cliente si le faltan datos
- `src/components/clientes/ClienteDetailDialog.tsx` — al abrir, complementar datos desde proyectos vinculados

