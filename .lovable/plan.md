## Objetivo

Asegurar que toda nota muestre `(Nombre del autor)` justo después de la fecha y antes del texto, tanto en el checklist (empresa/proyecto) como en la "Nota grupo" del proyecto.

## Estado actual

- **Checklist (`empresa_checklist_items`)**: el render ya muestra `({authorNames[created_by]})` después de la fecha. La inserción ya guarda `created_by = auth.uid()`. No requiere cambios funcionales — los registros antiguos (857) quedan sin autor por decisión del usuario.
- **Nota grupo del proyecto (`proyectos.nota_grupo`)**: es un textarea de texto libre. Hoy no inserta autor.

## Cambios a realizar

### 1. Auto-insertar "(autor)" en la "Nota grupo" al escribir una línea con fecha

En `src/pages/Proyectos.tsx` → componente `NotaGrupoCell`:

- Obtener el nombre del usuario actual una vez (vía `useAuth()` → `profile.display_name`, ya disponible en el componente padre; lo pasamos como prop `currentUserName` para no re-consultar en cada celda).
- Detectar dentro de `handleChange` cuando el usuario acaba de escribir una **fecha al inicio de una línea nueva** seguida de un espacio (patrón ya existente en el helper `startsWithDate` de `useEmpresaChecklist.ts`, exportado).
- Si la línea cumple el patrón fecha + espacio y **no contiene ya** `(...)` inmediatamente después de la fecha, transformar el texto insertando `(NombreAutor) ` justo después de la fecha.
- La transformación se hace una sola vez por línea (idempotente): si la línea ya tiene `(algo)` tras la fecha, no se vuelve a insertar.
- Se preserva el cursor lo mejor posible (se reubica al final del fragmento insertado).

Ejemplo:
```
Antes:  30.06 Visita a obra
Después:30.06 (Valentina Cabrera) Visita a obra
```

### 2. Pasar el nombre del autor a la celda

- En la fila del listado donde se renderiza `<NotaGrupoCell .../>`, pasar `currentUserName={profile?.display_name ?? ""}`.
- Si está vacío, el auto-insert se omite (degradación silenciosa).

### 3. Sin cambios de DB ni en checklist

- No se migra ni se hace backfill de notas históricas.
- `EmpresaChecklistPanel` y `useAddChecklistItem` quedan tal cual.

## Detalle técnico (para referencia)

- Regex de detección de fecha al inicio de línea: reutilizar `startsWithDate` (ya exporta el patrón yyyy.mm.dd / dd.mm.yyyy / dd.mm / "dd de mes").
- La transformación se ejecuta sobre la línea que contiene el cursor en el momento del cambio, no sobre todo el textarea, para no tocar líneas ya escritas por otros usuarios.
- Para evitar bucles, se compara `nextValue !== prevValue` antes de aplicar `setValue`.

## Archivos afectados

- `src/pages/Proyectos.tsx` (componente `NotaGrupoCell` y el call-site que lo renderiza).
