
## Contexto

- La pantalla de login carga bien en `amccomercial.lovable.app`.
- El usuario reporta pantalla en blanco después de iniciar sesión, para todos los usuarios, comenzó "recién".
- Cambios recientes: filtro de captador en `Proyectos.tsx`, `useAuth` ahora expone `captadorId`, `useDriveSync` ahora pide sesión antes de invocar la edge function `google-auth-callback`, y se resolvió un merge conflict en `Proyectos.tsx`.

## Hipótesis principal

En `src/pages/Proyectos.tsx` línea 89‑90 se llama al hook `useCaptadoresConUsuarios()` que está **declarado más abajo en el mismo archivo (línea 2254) como `function`**. Aunque las declaraciones `function` se hoistean, en algunos casos con HMR/exports lazy esto puede generar inicialización temporal indefinida. Más importante: este hook hace `supabase.from("captadores" as any).select(...)` sin manejar errores; si la tabla `captadores` no tiene política RLS que permita lectura a usuarios no‑admin, la query lanza/queda colgada para todos los no‑admin → causa pantalla blanca al entrar al listado por defecto (`/proyectos`).

Hipótesis secundaria: el `useEffect` que auto-aplica `setFilterCaptadores([captadorId])` corre también para admins que tengan captador asociado, dejando el listado vacío (no blanco, pero confunde).

## Cambios propuestos

1. **Refactor del hook a archivo propio** (`src/hooks/useCaptadoresConUsuarios.ts`) para eliminar dependencia de hoisting dentro del mismo archivo grande, e importarlo en `Proyectos.tsx`.
2. **Restringir la query** a admin/usuario_tipo_1: el filtro solo debe ser visible para ellos, así que el hook debe pasar `enabled: isAdmin || isUsuarioTipo1`. Esto evita el fetch fallido para captadores/usuarios sin permisos sobre la tabla.
3. **Verificar/añadir GRANT y policy** en `captadores` para que `authenticated` pueda hacer `SELECT` (necesario incluso si la query es solo admin, para evitar 403 silenciosos). Revisar primero el estado actual antes de migrar.
4. **Render defensivo del filtro**: en `Proyectos.tsx`, mostrar el `CaptadorFilterPopover` únicamente cuando `isAdmin || isUsuarioTipo1`, y no auto‑filtrar para admins que también sean captadores (`useEffect` solo aplica si `!isAdmin && !isUsuarioTipo1 && captadorId`).
5. **Pedir al usuario abrir la consola del navegador** (F12 → Console) y compartir el error rojo exacto si tras este arreglo persiste la pantalla en blanco. Esto es indispensable para descartar otras causas (p. ej. error en `useDriveSync` o en `usePresenceHeartbeat`).

## Detalles técnicos

- `src/hooks/useCaptadoresConUsuarios.ts`: exportar el hook ya existente, agregar parámetro `enabled` boolean.
- En `Proyectos.tsx`:
  - Eliminar la función local `useCaptadoresConUsuarios` y reemplazar las 4 llamadas por el import.
  - Pasar `enabled: isAdmin || isUsuarioTipo1` desde el componente raíz; los popovers internos pueden recibir la data por prop, o seguir llamando al hook con `enabled` apropiado.
  - Cambiar el `useEffect` que auto-aplica el filtro a: `if (captadorId && !isAdmin && !isUsuarioTipo1) setFilterCaptadores([captadorId]);`
- Migración SQL (solo si la revisión muestra que falta): `GRANT SELECT ON public.captadores TO authenticated;` y policy `FOR SELECT USING (true)` o equivalente al modelo existente.

## Verificación

- Ejecutar `bunx eslint src/pages/Proyectos.tsx` y revisar build.
- Probar preview con usuario admin y simular usuario captador para confirmar que el listado carga.
- Pedirle al usuario que recargue producción tras el redeploy y, si sigue en blanco, abra la consola y comparta el error.
