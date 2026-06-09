## Diagnóstico

La pantalla en blanco la causa un error de JavaScript que rompe toda la página de Proyectos:

```
TypeError: Cannot read properties of undefined (reading 'includes')
en CaptadorProjectCell (Proyectos.tsx)
```

**Causa raíz confirmada en la base de datos:** la captadora **Francisca Ortíz** tiene cuenta de usuario vinculada pero **no tiene fila en `user_permissions`**. El código asume que `empresasVisibles` es una lista o `null`, pero en este caso llega como `undefined`. La verificación `!== null` no detecta `undefined`, y al llamar `.includes(...)` sobre ese valor la página completa se cae.

Esto afecta a usuarios **admin** (como amoller@am-c.cl) porque la celda de captadores solo se renderiza para administradores. Que se vea bien en algunos dispositivos es solo efecto de caché.

## Cambios propuestos

**1. Corregir `src/pages/Proyectos.tsx` (defensa en el código):**
- En el hook `useCaptadoresConUsuarios`: normalizar `empresasVisibles` a `null` cuando no exista fila de permisos (`?? null`).
- En `CaptadorProjectCell` (cálculo de `asignados`): usar `Array.isArray(c.empresasVisibles)` en vez de `!== null`.
- En `CaptadorEmpresaCell` (misma lógica, línea ~2422): aplicar la misma corrección.
- En el filtro de la línea ~406: ya usa optional chaining, pero se reforzará igual.

**2. Verificación:**
- Abrir `/proyectos` en el preview como admin y confirmar que la página carga sin errores y la celda de captador muestra correctamente a Francisca Ortíz como "sin asignación".

No se requieren cambios en la base de datos: tener un captador sin fila de permisos es un estado válido (significa "sin restricciones configuradas todavía") y el código debe tolerarlo.