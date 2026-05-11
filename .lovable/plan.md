## Problema detectado

Los badges de empresa (en filas madre y filas hijas) muestran un monto que no corresponde al **Gran Total** real de la empresa. Ejemplo verificado en BD:

- Proyecto "Casa MR" — empresa JACIMA — PE `7237c8b6…`
- `proyecto_empresas.ganado_presupuesto`: `440,81` UF
- `ventas_proyecto_empresa`: 0 filas
- `historial_estatus_empresa` (subcategoría = Ganado):
  - 12/03/2026 → `440,81` UF
  - 12/03/2026 → `512,78` UF
- **Badge muestra:** `440,81 UF`
- **Gran Total esperado:** suma de las ventas registradas (las dos entradas Ganado del historial + cualquier venta adicional)

## Causa raíz

`ventasMap` en `src/pages/Proyectos.tsx` (línea 403) calcula el total así:

```
total = ganado_presupuesto (de proyecto_empresas)
      + Σ monto_uf (de ventas_proyecto_empresa)
```

`ganado_presupuesto` se sobrescribe cada vez que el usuario edita la categoría (solo guarda el último valor), por lo que ventas anteriores registradas como entradas Ganado en el **Historial** se pierden del cálculo. Las "ventas adicionales" reales viven en `historial_estatus_empresa` (cada entrada Ganado = una venta concreta con su monto y fecha), no en la tabla `ventas_proyecto_empresa`.

## Plan de cambio (solo presentación, sin tocar negocio)

### 1. Nueva fuente de verdad para el Gran Total por PE

En `src/pages/Proyectos.tsx`, reemplazar la lógica de `ventasMap`:

```
GranTotal[pe.id] = Σ monto_uf de TODAS las entradas de historial_estatus_empresa
                   donde la subcategoría tiene es_adjudicado = true
                 + Σ monto_uf de ventas_proyecto_empresa[pe.id]
```

- Se elimina el uso directo de `ganado_presupuesto` para el badge (ya está representado por su entrada correspondiente en el historial).
- Se ignoran entradas con `monto_uf = 0` (filas de cambio de estado sin venta).
- `allHistorialData` ya está cargado y paginado correctamente desde el fix anterior; solo agregamos el cómputo.

### 2. Aplicación en los componentes

Los tres lugares que ya leen `ventasMap` se mantienen sin cambios de firma:
- `EmpresasCell` (línea 1481) — fila hija.
- `GroupEmpresasCell` (línea 1568) — fila madre, agrega por `empresa_id` en el grupo.
- Detalle expandido (línea 1723).

Solo cambia el contenido del Map.

### 3. Sin cambios de schema ni de lógica de negocio

- No se modifican tablas, RLS, ni mutaciones.
- Solo cambia el cálculo presentacional en el listado de Proyectos.
- El formulario (`ProyectoFormDialog`) ya muestra "Gran Total" con la misma intención y se ajustará en una iteración aparte si quedara desalineado.

### 4. Verificación

Tras el cambio, JACIMA en "Casa MR" debe mostrar `953,59 UF` (440,81 + 512,78). Validar también una empresa con ventas adicionales en `ventas_proyecto_empresa` para confirmar que ambas fuentes se suman.

## Pregunta antes de implementar

¿Las entradas con subcategoría **Ganado** en el historial deben contarse **todas** como ventas independientes (suma completa), o sólo la **más reciente** debe representar el monto vigente? (La evidencia y la memoria *Additional Sales* sugieren "todas".)