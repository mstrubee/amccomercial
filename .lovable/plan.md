

## Plan: Clientes y Captadores + Integración en Proyectos

### Resumen

Se renombra la sección "Clientes" a "Clientes y Captadores", se agrega una nueva entidad "Captadores" con la misma estructura que los clientes, se integran ambos en la vista y edición de proyectos, y se agrupan las alertas completadas en la edición.

---

### 1. Base de datos: Tablas para Captadores

Crear dos nuevas tablas que replican la estructura de clientes:

- **`captadores`**: misma estructura que `clientes` (id, nombre, categoria_id apunta a `categorias_cliente`, contacto, email, telefono, timestamps)
- **`contactos_captador`**: misma estructura que `contactos_cliente` (id, captador_id, contacto, email, telefono, orden, timestamps)
- **`proyecto_clientes`**: tabla de relacion many-to-many entre proyectos y clientes (id, proyecto_id, cliente_id)
- **`proyecto_captadores`**: tabla de relacion many-to-many entre proyectos y captadores (id, proyecto_id, captador_id)

Las RLS serán iguales a las de `clientes`/`contactos_cliente`:
- Lectura para todos los autenticados
- Escritura para admin y usuario_tipo_1
- Eliminacion solo para admin

### 2. Renombrar sección "Clientes" a "Clientes y Captadores"

**Archivos afectados:**
- `src/components/layout/AppLayout.tsx`: Cambiar label del item de navegacion de "Clientes" a "Clientes y Captadores"
- `src/pages/Clientes.tsx`: Convertir en pagina con dos pestanas (Tabs): "Clientes" y "Captadores"

La pestaña Clientes mantiene todo como esta actualmente. La pestaña Captadores tendra la misma interfaz pero operando sobre las tablas `captadores` y `contactos_captador`. Se creara un hook `useCaptadores.ts` con la misma estructura que `useClientes.ts`.

### 3. Nuevo hook: `src/hooks/useCaptadores.ts`

Replica la misma estructura de `useClientes.ts` pero apuntando a las tablas `captadores` y `contactos_captador`:
- `useCaptadores()` - listar
- `useCreateCaptador()` - crear
- `useUpdateCaptador()` - actualizar
- `useDeleteCaptador()` - eliminar

### 4. Integración en Proyectos: Campos Cliente y Captador en el formulario de edición

**Archivo:** `src/components/proyectos/ProyectoFormDialog.tsx`

Dentro de la seccion colapsable "Contactos" (o en una nueva seccion), agregar dos nuevos campos:

- **Cliente**: Un picker similar al `ClientePicker` existente que permite seleccionar de la lista de clientes o crear uno nuevo. Se almacena la relacion en `proyecto_clientes`.
- **Captador**: Mismo mecanismo pero seleccionando de la lista de captadores. Se almacena en `proyecto_captadores`.

El `ProyectoInput` se extiende con `cliente_ids: string[]` y `captador_ids: string[]`.

Los hooks `useCreateProyecto` y `useUpdateProyecto` se modifican para manejar las inserciones/eliminaciones en `proyecto_clientes` y `proyecto_captadores`.

### 5. Columna "Contactos" en la tabla de proyectos (linea madre)

**Archivo:** `src/pages/Proyectos.tsx`

Agregar una nueva columna "Contactos" entre "Proyecto" e "Ingreso" en la cabecera de la tabla:

```text
N° | Proyecto | Contactos | Ingreso | Comuna | ...
```

En esa celda se muestran dos botones apilados verticalmente:
- **"Clientes"** en azul (`text-blue-600`): al hacer clic, abre un Popover con los clientes vinculados al proyecto. Si no hay clientes, muestra un icono X rojo a la izquierda. Dentro del popover se pueden agregar/quitar clientes.
- **"Captadores"** en rojo (`text-red-600`): al hacer clic, abre un Popover con los captadores vinculados. Misma logica.

Cada popover permite:
- Ver los existentes
- Seleccionar del listado de clientes/captadores existentes
- Crear uno nuevo (se guarda en la tabla correspondiente)

### 6. Alertas completadas colapsadas en edición

**Archivo:** `src/components/proyectos/ProyectoFormDialog.tsx`

En la seccion "Alertas" dentro del formulario de edicion (lineas ~582-619), separar las alertas en dos grupos:
- **Activas**: se muestran siempre visibles
- **Completadas**: se muestran dentro de un `Collapsible` cerrado por defecto, con un trigger que dice "Completadas (N)" que se puede expandir

### 7. Query de proyectos actualizada

**Archivo:** `src/hooks/useProyectos.ts`

La query de `useProyectos` se extiende para incluir:
```
proyecto_clientes(*, clientes(*)), proyecto_captadores(*, captadores(*))
```

El tipo `ProyectoWithEmpresas` se extiende para incluir las relaciones con clientes y captadores.

---

### Secuencia de implementacion

1. Migracion de base de datos (crear 4 tablas + RLS)
2. Crear hook `useCaptadores.ts`
3. Modificar pagina Clientes con tabs + seccion Captadores
4. Modificar `useProyectos.ts` para incluir relaciones cliente/captador
5. Modificar `ProyectoFormDialog.tsx` para agregar pickers de cliente y captador
6. Modificar `Proyectos.tsx` para agregar columna "Contactos" con popovers
7. Modificar alertas completadas en formulario con Collapsible
8. Actualizar navegacion en `AppLayout.tsx`

