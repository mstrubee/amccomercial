

## Corregir acceso a empresas para vcabrera@am-c.cl

### Problema
La usuaria `vcabrera@am-c.cl` tiene configurado en sus permisos un filtro que restringe su visibilidad a solo 4 empresas (`empresas_visibles` contiene 4 IDs). Esto le impide ver y actuar sobre alertas/proyectos de otras empresas, lo cual explica los problemas que tuvo al intentar completar alertas delegadas.

### Solución
Actualizar el registro de `user_permissions` para esta usuaria, estableciendo `empresas_visibles` en `null`. Cuando este campo es `null`, el sistema interpreta que tiene acceso a **todas** las empresas (sin restricción).

### Datos actuales
- **Usuario:** Valeria Cabrera (vcabrera@am-c.cl)
- **user_id:** `5552399d-2c75-4bed-a500-e88d3ee68f5e`
- **empresas_visibles:** 4 empresas especificas (restringido)
- **secciones_visibles:** `[proyectos, alertas]`
- **dashboard_widgets:** `[graficos_estado, proyectos_recientes, alertas]`
- **puede_editar:** true

### Cambio a ejecutar
Ejecutar un `UPDATE` en la tabla `user_permissions` para poner `empresas_visibles = null` donde `user_id = '5552399d-2c75-4bed-a500-e88d3ee68f5e'`.

No se requieren cambios de código ni migraciones de esquema. Solo una actualización de datos.
