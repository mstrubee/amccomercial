# CLAUDE.md — AMC Comercial

## REGLA ABSOLUTA: INTEGRIDAD DE DATOS DE USUARIO

**JAMÁS hacer cambios de datos en la base de datos que hayan sido escritos por un usuario.**

Esto incluye, sin excepción:
- Estatus de proyectos (`estado_obra`, `estado_amc`, `clasificacion_id`)
- Datos de contacto (arquitecto, constructora, ITO, dueños)
- Categorías o subcategorías de empresa-proyecto
- Montos, adjudicaciones, historiales de estatus
- Notas o cualquier campo textual ingresado por usuario
- Cualquier fila en tablas: `proyectos`, `proyecto_empresas`, `alertas`, `empresa_checklist_items`, `historial_estatus_empresa`, `delegaciones_alerta`

**La única excepción son migraciones de esquema (DDL) o nuevas funciones RPC aprobadas explícitamente por el usuario.**

Ante cualquier duda: describir el cambio en texto y esperar aprobación. Nunca ejecutar SQL UPDATE/DELETE/INSERT sobre datos existentes sin instrucción explícita.
