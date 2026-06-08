## Objetivo

En el diálogo de permisos de usuario (pestaña **Secciones**), agregar un segundo checkbox como sub-fila debajo de **Empresas** y **Proyectos** que permita al administrador elegir entre:
- **Ver todos** los registros de la sección, o
- **Solo asignados** (filtrado por `empresas_visibles`).

Default: **Solo asignados**.

## Cambios

### 1. Base de datos
Nueva columna en `user_permissions`:
- `secciones_solo_asignados text[]` — lista de keys de secciones donde el usuario ve solo lo asignado (por defecto `['empresas','proyectos']` cuando la sección está habilitada y no se marca "Ver todos").

Migración: `ALTER TABLE public.user_permissions ADD COLUMN secciones_solo_asignados text[] DEFAULT ARRAY['empresas','proyectos']::text[];`

### 2. UI — `src/pages/Usuarios.tsx`
En el bloque `ALL_SECTIONS.map(...)` (Tabs > Secciones), cuando la sección sea `empresas` o `proyectos`, renderizar debajo del label una sub-fila indentada con un Checkbox:
- Label: "Solo empresas asignadas" / "Solo proyectos de empresas asignadas"
- Estado: `secciones_solo_asignados.includes(key)`
- Toggle agrega/quita la key.
- Deshabilitado si la sección no está marcada.

Agregar `secciones_solo_asignados` al estado local, carga inicial y al payload de `useSavePermissions`.

### 3. Hooks y tipos
- `src/hooks/usePermissions.ts`: agregar campo `secciones_solo_asignados: string[] | null` a `UserPermissions` e incluirlo en `useSavePermissions`.
- `src/hooks/useAuth.ts`: exponer `secciones_solo_asignados` en `UserPermissionsData` y agregar helper `sectionRestrictedToAssigned(key)`.

### 4. Aplicar el filtro
En las páginas `Empresas.tsx` y `Proyectos.tsx`: cuando `sectionRestrictedToAssigned('empresas'|'proyectos')` sea true y el usuario tenga `empresas_visibles` con valor, filtrar el listado por esas empresas. Si es admin o el usuario tiene "Ver todos", no aplicar restricción adicional.

Regla de admin existente (memoria): `vcabrera@am-c.cl` sigue con `empresas_visibles = null` y por tanto ve todo siempre.

## Fuera de alcance

- No se cambia la lógica de Finanzas, Alertas, Reuniones (ya filtran por `empresas_visibles` cuando está definido).
- No se modifica `ClientePicker` ni dedupe de clientes.
