## Objetivo

Al crear una nota en el checklist (de proyecto o de empresa), mostrar el nombre del autor entre paréntesis justo después de la fecha y antes del texto. Ej:

```text
24.03  (Pablo Pérez)  Dejaron OG lista, obra retoma en Marzo...
```

## Cambios

### 1. Base de datos — migración

Tabla `public.empresa_checklist_items`:
- Agregar columna `created_by uuid` (FK a `auth.users`, sin `NOT NULL` para no romper filas históricas).
- Índice por `created_by` (opcional, lo dejo fuera si no se necesita filtrar).
- Las filas existentes quedan con `created_by = NULL` → se muestran sin autor (comportamiento actual).
- No se tocan las policies de RLS ya existentes.

### 2. Captura del autor al crear el ítem

`src/hooks/useEmpresaChecklist.ts`:
- `useAddChecklistItem`: incluir `created_by: auth.uid()` en el `insert`. Se obtiene con `supabase.auth.getUser()` o aceptando `user_id` como parámetro desde el llamador (ya tenemos `useAuth()` en el panel y los diálogos).
- Actualizar la interfaz `ChecklistItem` para incluir `created_by: string | null`.

### 3. Mostrar el nombre

`src/components/empresas/EmpresaChecklistPanel.tsx`:
- Cargar un mapa `userId → display_name` desde `profiles` con un hook ligero (reutilizar uno existente si lo hay, o crear `useProfilesMap(userIds)` que consulta `profiles` por los IDs únicos presentes en los ítems).
- En `renderItem`, justo después del bloque de fecha y antes del texto, mostrar `(<nombre>)` con estilo muted, solo cuando `created_by` existe y se resuelve a un nombre.

### 4. Exportación de Reuniones (opcional, recomendado)

`src/pages/AtencionEmpresas.tsx` — en `buildExportRows`, prefijar la nota con `(autor) ` para que el Excel también muestre el autor. Si prefieres no tocar la exportación, lo omitimos.

## Detalle técnico

- No se modifica el comportamiento de edición de texto/fecha ni completado: el autor queda fijo al momento de creación.
- Si `created_by` es `NULL` (ítems antiguos) o el perfil no tiene `display_name`, no se renderiza el paréntesis para no mostrar "(Desconocido)".
- El nombre viene de `profiles.display_name` (la columna `email` fue removida del schema previamente).
- No se requiere edición del autor por la UI; un admin podría cambiarlo vía SQL si fuera necesario.

## Preguntas abiertas

1. ¿Aplicar también el autor en la exportación a Excel de "Reuniones" (sección 4)?
2. ¿Mostrar el autor también en sub-ítems anidados, o solo en notas de primer nivel? (Por defecto: en todos los niveles, para consistencia.)
