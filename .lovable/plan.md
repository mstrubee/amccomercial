## Objetivo

Habilitar al rol **Captador** para editar proyectos y empresas, y para crear proyectos nuevos. Al crear un proyecto, todas las empresas seleccionadas en el formulario quedan automáticamente vinculadas al captador (admin podrá luego reasignar).

## Cambios

### 1. `src/pages/Proyectos.tsx` — habilitar edición a captadores
- Quitar el guard `!isCaptador` del botón **Editar línea madre** (línea 1159) → mostrar a captadores.
- Quitar el guard `!isCaptador` del botón **Editar** por empresa-hijo (línea 1296) → mostrar a captadores.
- Mantener el botón **Eliminar** restringido a admin (no se pide eliminación).
- El botón "Nuevo Proyecto" ya está visible para todos, no requiere cambio.

### 2. `src/pages/Proyectos.tsx` — auto-vinculación al crear
La lógica actual (líneas 1340-1360) ya hace merge de las empresas del nuevo proyecto en `user_permissions.empresas_visibles` del captador. Se complementará para:
- Insertar también una fila en `proyecto_captadores` (proyecto_id, captador_id) por cada proyecto-empresa creado, de modo que el filtro por captador y la columna captador del admin muestren el vínculo inmediatamente.
- Invalidar la query `["proyectos"]` luego del upsert para que la UI refleje el nuevo vínculo (await `invalidateQueries` antes de cerrar diálogo — regla de UX).

### 3. `src/pages/Empresas.tsx` — habilitar edición a captadores
- Confirmar que botones Editar/Nueva Condición no estén gateados por `isAdmin` excluyendo al captador. Hoy usan `permissions`/`isSectionRestrictedToAssigned` y no excluyen explícitamente al captador, por lo que probablemente no requiere cambio en la UI. Verificar y, si hay algún `if (!isCaptador)` o `if (isAdmin)` en acciones de edición, ajustarlo para permitir al captador.

### 4. RLS en Supabase
Revisar las policies de:
- `proyectos` (INSERT, UPDATE)
- `proyecto_empresas` (INSERT, UPDATE, DELETE)
- `proyecto_captadores` (INSERT)
- `empresas` (UPDATE)
- `condiciones_comerciales` (INSERT/UPDATE, si captador edita empresa)
- `user_permissions` (UPDATE del propio captador para hacer el merge de `empresas_visibles`)

Si alguna policy actual restringe a admin solamente, crear una migración que añada policies adicionales permitiendo al captador (cuando `EXISTS (SELECT 1 FROM captadores WHERE user_id = auth.uid())`) realizar las operaciones requeridas, **limitado a empresas en su `empresas_visibles`** para evitar escalamiento.

### 5. Verificación
- Login como captador → ver botones Editar visibles en proyectos y empresas.
- Crear proyecto con 2 empresas → confirmar fila en `proyecto_captadores`, `empresas_visibles` actualizado, proyecto visible en su filtro.
- Editar un proyecto existente como captador → sin errores RLS.
- Login como admin → la columna captador del proyecto refleja el vínculo y se puede modificar.

## Notas técnicas

- Mantener intacta la lógica de visibilidad existente para captadores (filtros + permisos).
- No tocar policies de DELETE en proyectos/empresas para captadores.
- La memoria del proyecto requiere `await invalidateQueries` antes de cerrar diálogos; se respetará en el flujo de creación.