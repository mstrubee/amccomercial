## Diagnóstico

Encontré la causa de las reasignaciones aleatorias. Está en `src/pages/Proyectos.tsx`, en el bloque que llamamos "legacy" (líneas 500‑535 y 2630‑2646).

Hoy, para decidir qué captador "es dueño" de un proyecto, el código:

1. Mira si el proyecto tiene una fila en `proyecto_captadores` (sistema nuevo, explícito) → si la hay, usa esa. ✅
2. **Si no hay fila**, recorre todos los captadores y atribuye el proyecto al primer captador cuyo `empresas_visibles` contenga la empresa del proyecto, siempre que ese captador no tenga *ninguna* fila en `proyecto_captadores` en toda la base. ⚠️

Ese paso 2 es el que produce los síntomas descritos:

- Cuando el admin agrega una empresa al `empresas_visibles` de un captador (sólo para darle visibilidad), **todos los proyectos existentes de esa empresa aparecen como asignados a él**.
- Si dos captadores comparten una misma empresa en `empresas_visibles` y ninguno ha creado proyectos todavía, el "dueño" mostrado depende del orden del array → cambia entre sesiones y se ve como aleatorio.
- En la columna "Captador" del admin y en el filtro "Mis proyectos" del captador, los proyectos aparecen y desaparecen sin que nadie los haya tocado realmente.

Además, al crear un proyecto, el captador llama `captador_add_empresas_visibles` (RPC) que mergea la empresa en su propia `empresas_visibles`. Eso es correcto para visibilidad futura, pero amplifica el problema anterior si quedan captadores "legacy".

## Solución propuesta

Eliminar por completo el fallback legacy de atribución y dejar que **`proyecto_captadores` sea la única fuente de verdad** para "captador dueño del proyecto". `empresas_visibles` queda solo para lo que está pensado: filtrar qué empresas ve un usuario.

### Cambios

1. **`src/pages/Proyectos.tsx`**
   - `getAssigned` (≈2630): borrar el bloque que recorre `captadoresConUsuarios` y compara `empresasVisibles`. Si no hay fila en `proyecto_captadores`, devolver `null` (proyecto sin captador asignado).
   - `visibleProyectoNamesByCaptador` (≈516): borrar la rama "Legacy (empresas_visibles)". Un proyecto solo es visible para un captador en el filtro si tiene fila en `proyecto_captadores`.
   - `captadoresInNewSystem` (≈500): ya no es necesario; eliminarlo y sus usos.
   - `asignados` (≈2649): queda igual, pero ahora solo refleja asignaciones reales.

2. **Visibilidad del captador en su propia vista** (líneas 1456‑1459, 1093‑1094 y el effect 229)
   - El captador seguirá viendo "Mis proyectos" usando `filterCaptadores` precargado con su `captadorId`. Como el filtro ahora solo cuenta `proyecto_captadores`, verá exactamente los proyectos en los que está explícitamente asignado.
   - Esto no afecta las RLS (la base ya lo permite); solo ajusta la UI.

3. **Sin cambios en backend / RLS / RPC**
   - No tocar `captador_add_empresas_visibles`: sigue siendo correcto para que el captador pueda ver las empresas relacionadas a los proyectos que crea.
   - No tocar policies de `proyecto_captadores` ni `user_permissions`.

### Verificación

- Login como admin: la columna "Captador" debe mostrar exactamente el captador insertado en `proyecto_captadores`, o vacío si no hay. Asignar/desasignar manualmente sigue funcionando.
- Login como captador A con empresa X en `empresas_visibles` pero sin filas en `proyecto_captadores`: ya no verá proyectos ajenos de la empresa X bajo "Mis proyectos".
- Captador que crea un proyecto nuevo: aparece asignado a él inmediatamente (vía la fila que inserta en `proyecto_captadores` en línea 1618‑1620).
- Re-asignación de un proyecto desde el admin: se mantiene; el override optimista y la invalidación de queries siguen igual.

### Riesgo / migración de datos

Si hay captadores que hoy "se veían dueños" gracias al fallback legacy y eso era el comportamiento esperado en algún caso, dejarán de aparecer asignados hasta que el admin (o el captador, creando el proyecto) inserte la fila correspondiente en `proyecto_captadores`. Si quieres, en un paso posterior puedo proponer una migración única para sembrar `proyecto_captadores` a partir del estado actual, pero por defecto **no** lo incluyo en este fix para evitar asignar en masa proyectos a captadores equivocados — que es justo el problema que reportas.
