
## Problema detectado

El badge `Empresa · Estatus` que aparece en cada fila de la línea madre (componente `GroupEmpresasCell` en `src/pages/Proyectos.tsx` ~línea 1478) se construye leyendo `proyecto_empresas.categoria_id` / `subcategoria_id` directamente de la tabla. Sin embargo, el formulario de edición y la lógica real de "estado especificado por el usuario" se basan en la última entrada de `historial_estatus_empresa` (ver `getSelectValue` en `ProyectoFormDialog.tsx` líneas 426-436).

Esto produce desincronización en al menos tres escenarios:

1. El usuario abre el formulario, cambia el estatus → se inserta inmediatamente en `historial_estatus_empresa` (línea 384) y solo se actualiza `proyecto_empresas` localmente. Si cierra sin presionar **Guardar**, queda historial nuevo + `proyecto_empresas` viejo. El badge muestra el viejo, el formulario muestra el nuevo.
2. Una alerta avanza la categoría (`onAdvanceCategoria`, línea 1242) → actualiza `proyecto_empresas` pero NO crea entrada en historial. El badge muestra el nuevo, el historial muestra el viejo.
3. Cargas masivas o ediciones directas que tocan solo una de las dos tablas.

Decisiones del usuario:
- **Fuente de verdad**: la última entrada del historial (más reciente por `fecha`, desempatando por `created_at`).
- **Si no se presiona Guardar**: descartar todo, incluido el historial.

## Cambios

### 1. Badge del listado (línea madre) — usar historial como fuente

Archivo: `src/pages/Proyectos.tsx` (`GroupEmpresasCell`)

- Cargar el historial completo agrupado por `proyecto_empresa_id` mediante un nuevo hook `useHistorialEstatusByPeIds(peIds)` (similar al `useHistorialEstatusByIds` ya existente, pero compartido a nivel de página).
- En `GroupEmpresasCell`, para cada empresa única del grupo, calcular la última entrada de historial entre todos los `proyecto_empresa_id` ligados a esa empresa (fecha desc, luego created_at desc).
- Derivar `categoria` y `subcategoria` desde esa última entrada (no desde `proyecto_empresas`). Caer al valor de `proyecto_empresas` solo si no hay historial alguno.
- La fecha mostrada en el badge será `fecha` del historial (no `fecha_categoria`).
- Aplicar el mismo cambio a las filas hijas (badge individual por empresa) si lo hubiera, para mantener consistencia.

### 2. Formulario de edición — descartar al cerrar sin guardar

Archivo: `src/components/proyectos/ProyectoFormDialog.tsx`

- En `handleGanadoConfirm`, no llamar a `createHistorial.mutate` directamente. En su lugar, registrar la entrada como **pendiente** en estado local: `pendingHistorialEntries: { peId, categoria_id, subcategoria_id, monto_uf, fecha }[]`.
- `getSelectValue` debe considerar primero `pendingHistorialEntries` (más reciente local), luego el historial real, y finalmente `proyecto_empresas`.
- En `handleSubmit` (Guardar), después de actualizar `proyecto_empresas`, ejecutar `createHistorial.mutate` para cada entrada pendiente, y limpiar el estado pendiente.
- Al cerrar el diálogo sin guardar (cancelar / `onOpenChange(false)`), simplemente descartar el estado pendiente; nada se persiste.
- Eliminar la lógica de "revertir cambio de categoría" en `handleGanadoCancel` ya que ahora todo es local hasta Guardar.

### 3. Sincronización al avanzar desde alertas

Archivo: `src/pages/Proyectos.tsx` (`onAdvanceCategoria`, línea 1241)

- Tras actualizar `proyecto_empresas`, crear también una entrada en `historial_estatus_empresa` con la nueva `categoria_id` / `subcategoria_id`, `fecha = hoy`, `monto_uf = ganado_presupuesto || 0`.
- Invalidar `["historial_estatus_empresa"]` además de `["proyectos"]`.

### 4. Pruebas manuales

- Cambiar estatus en el formulario y **cancelar** → badge no cambia, formulario al reabrirlo tampoco.
- Cambiar estatus y **Guardar** → badge cambia inmediatamente y todos los usuarios lo ven (ya hay realtime en `historial_estatus_empresa`).
- Completar una alerta que avanza categoría → badge se actualiza y queda registrado en historial.
- Editar manualmente un registro de historial (eliminar la última entrada) → badge vuelve a la entrada anterior.

## Detalles técnicos

- No se requiere migración de base de datos: la tabla `historial_estatus_empresa` ya existe con realtime habilitado.
- Performance: cargar historial en bloque por todos los `proyecto_empresa_id` visibles (una sola query, ya paginada por el patrón `.range()` si el volumen lo amerita). Memorizar el "último por PE" en un `Map<string, HistorialEntry>` en `Proyectos.tsx` y pasarlo como prop a `GroupEmpresasCell`, igual que se hace con `ventasMap`.
- El estado `pendingHistorialEntries` se guarda como un Map por `empresa_id` para que múltiples cambios al mismo registro durante una sesión de edición se sustituyan (solo el último cuenta al guardar).

## Memoria a actualizar tras implementar

Anotar en `mem://logic/proyectos/estatus-comerciales-empresa` que la fuente de verdad del estatus mostrado en el listado es la última entrada de `historial_estatus_empresa`, y que los cambios en el formulario son locales hasta presionar Guardar.
