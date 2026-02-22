

# Clasificaciones de Alertas

## Resumen
Agregar un sistema de clasificaciones (con sub-clasificaciones) para las alertas. Esto incluye nuevas tablas en la base de datos, un dialog de administracion, un filtro en la Central de Alertas, y la seleccion de clasificacion al crear/editar alertas.

## Cambios en Base de Datos

1. **Tabla `clasificaciones_alerta`**: id, nombre, orden, created_at
2. **Tabla `subclasificaciones_alerta`**: id, clasificacion_id (FK), nombre, orden, created_at
3. **Columnas nuevas en `alertas`**: `clasificacion_alerta_id` (uuid, nullable), `subclasificacion_alerta_id` (uuid, nullable)
4. **Politicas RLS**: Lectura para todos los autenticados, gestion completa solo para admins
5. **Habilitar realtime** no es necesario para este caso

## Cambios en Codigo

### 1. Hook `src/hooks/useClasificacionesAlerta.ts` (nuevo)
- CRUD para `clasificaciones_alerta` y `subclasificaciones_alerta`
- Queries: `useClasificacionesAlerta()` que trae clasificaciones con sus sub-clasificaciones
- Mutations: crear, editar, eliminar clasificaciones y sub-clasificaciones

### 2. Dialog de administracion `src/components/alertas/ClasificacionesAlertaDialog.tsx` (nuevo)
- Dialog accesible solo para Admin
- Lista de clasificaciones con opcion de agregar, editar y eliminar
- Cada clasificacion expandible para gestionar sub-clasificaciones
- Boton ubicado entre "Arbol" y "Eliminadas" en la barra de acciones

### 3. Modificar `src/pages/Alertas.tsx`
- Importar el nuevo dialog y hook
- Agregar boton "Clasificacion" entre "Arbol" y "Eliminadas" (visible solo para admin)
- Agregar filtro Select de clasificacion junto a los filtros existentes
- Filtrar alertas por `clasificacion_alerta_id` cuando se seleccione

### 4. Modificar `src/components/alertas/AlertaFormDialog.tsx`
- Agregar selector de Clasificacion (dropdown)
- Agregar selector de Sub-clasificacion (dropdown, dependiente de la clasificacion seleccionada)
- Incluir `clasificacion_alerta_id` y `subclasificacion_alerta_id` en el submit

### 5. Modificar `src/hooks/useAlertas.ts`
- Agregar `clasificacion_alerta_id` y `subclasificacion_alerta_id` a `AlertaRow`, `AlertaInput`
- Incluir estos campos en las mutaciones de crear y actualizar
- Incluir la relacion en la query select para mostrar el nombre de la clasificacion

### 6. Mostrar clasificacion en la tabla de alertas
- Agregar columna "Clasificacion" en la tabla de la Central de Alertas

## Seccion Tecnica

```text
clasificaciones_alerta          subclasificaciones_alerta
+--------+---------+-----+      +--------+------------------+---------+-----+
| id     | nombre  |orden|      | id     | clasificacion_id | nombre  |orden|
+--------+---------+-----+      +--------+------------------+---------+-----+
| uuid   | text    | int |      | uuid   | uuid (FK)        | text    | int |
+--------+---------+-----+      +--------+------------------+---------+-----+

alertas (columnas nuevas)
+---------------------------+--------------------------------+
| clasificacion_alerta_id   | subclasificacion_alerta_id     |
| uuid nullable             | uuid nullable                  |
+---------------------------+--------------------------------+
```

La migracion SQL creara ambas tablas con RLS habilitado, politicas de lectura publica para autenticados y gestion exclusiva para admins. Luego agregara las dos columnas a la tabla `alertas`.
