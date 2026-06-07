## Objetivo

Cambiar el comportamiento del botón **"Crear nuevo cliente"** dentro del `ClientePicker` (en `ProyectoFormDialog`) para que, en lugar de abrir el mini-formulario inline, lleve al usuario a la sección **Clientes y Captadores** (`/clientes`). Al salir del editor, mostrar un **botón flotante** que permita volver al editor de proyecto en el mismo punto.

## Cambios

### 1. `src/components/proyectos/ProyectoFormDialog.tsx`
- En el `onClick` del botón "Crear nuevo cliente":
  1. Cerrar el popover del picker.
  2. Guardar en `sessionStorage` un snapshot con: `proyectoId` (o "new"), `grupoId`, `empresaId` del row activo, el rol de contacto que se estaba editando, y la ruta de retorno `/proyectos`.
  3. Cerrar el diálogo de edición (`onOpenChange(false)`).
  4. `navigate("/clientes?from=proyecto")`.
- Al montar el diálogo, si recibe una prop/flag de "reanudar" (o detecta el snapshot), abrir automáticamente el proyecto correcto y el row correcto en modo edición.

### 2. `src/pages/Proyectos.tsx`
- Al montar, leer el snapshot de `sessionStorage` (clave p. ej. `amc:resume-proyecto-edit`). Si existe, abrir `ProyectoFormDialog` con ese `grupoId` y mantener la marca hasta que el usuario lo cierre normalmente (la marca se limpia al guardar o cerrar el diálogo).

### 3. Nuevo componente `src/components/proyectos/BackToProyectoFloat.tsx`
- Análogo a `BackToAlertasFloat.tsx`.
- Se renderiza globalmente desde `AppLayout` (o desde `AppRoutes`) **solo cuando**:
  - existe el snapshot en `sessionStorage`, **y**
  - la ruta actual **no** es `/proyectos`.
- Posición: `fixed top-4 right-4 z-[100]` (esquina superior derecha, always-on-top).
- Contenido: ícono + texto "Volver a Editar Proyecto" + botón `X` para cerrar (descarta el snapshot).
- Click principal: `navigate("/proyectos")`; `Proyectos.tsx` detecta el snapshot y reabre el diálogo.

### 4. `src/components/layout/AppLayout.tsx`
- Montar `<BackToProyectoFloat />` junto a los otros widgets flotantes para que aparezca en cualquier ruta.

## Detalles técnicos

- Snapshot:
  ```ts
  sessionStorage.setItem("amc:resume-proyecto-edit", JSON.stringify({
    grupoId, empresaId, rolContacto, ts: Date.now()
  }));
  ```
- El float usa un `useEffect` + listener a `storage` y a un evento custom (`amc:resume-changed`) para reaccionar a cambios en la misma pestaña.
- El botón "X" del float llama `sessionStorage.removeItem(...)` y dispara el evento custom.
- Estilos con tokens semánticos del design system (sin colores crudos).
- Sin cambios de backend ni de lógica de negocio.

## Archivos

- `src/components/proyectos/ProyectoFormDialog.tsx` (editar)
- `src/pages/Proyectos.tsx` (editar — auto-reabrir el diálogo)
- `src/components/proyectos/BackToProyectoFloat.tsx` (nuevo)
- `src/components/layout/AppLayout.tsx` (montar el float)
