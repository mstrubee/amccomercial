## Problema

Hoy hay dos fórmulas distintas para el "Gran Total" de una empresa en un proyecto:

- **Formulario** (`ProyectoFormDialog.ventasTotalByEmpresa`):
  `pe.ganado_presupuesto + Σ ventas_proyecto_empresa[pe.id]`
  → es el valor mostrado en el span seleccionado (`Gran Total: 1.981,82 UF ≈ $76.300.070`).
- **Listado** (`Proyectos.ventasMap`, líneas 405-429):
  `monto_uf de la última entrada adjudicada del historial + Σ ventas adicionales`

Cuando `ganado_presupuesto` no coincide con el `monto_uf` del último ítem del historial (porque el usuario editó el monto en el bloque "Ganado" sin generar una nueva entrada de historial, o viceversa), el badge del listado y el Gran Total del formulario muestran cifras distintas.

El usuario confirma que el valor mostrado en el formulario es la verdad: ese mismo Gran Total debe usarse en todos los lugares que requieran "Gran Total".

## Regla única (alineada al formulario)

Para cada `proyecto_empresa pe`:

```text
GranTotal[pe.id] = (Number(pe.ganado_presupuesto) || 0)
                 + Σ Number(v.monto_uf) para v en ventas_proyecto_empresa[pe.id]
```

- `ganado_presupuesto` ya es la fuente de verdad del monto adjudicado de la empresa (lo escribe el formulario al editar el bloque Ganado y se persiste en `proyecto_empresas`).
- `ventas_proyecto_empresa` aporta solo los adicionales (mismo criterio actual).
- Si la empresa no está adjudicada, `ganado_presupuesto` es `null/0` y solo cuentan las ventas adicionales (consistente con el formulario).
- El historial deja de participar en el cómputo del Gran Total. Sigue siendo la fuente del **estado** vigente (`statusByPe`), pero no del monto.

## Cambio puntual

### `src/pages/Proyectos.tsx` — `ventasMap` (líneas 405-429)

Reemplazar el bucle sobre `latestHistorialByPe` por uno que recorra `proyectos → proyecto_empresas` y use `ganado_presupuesto`. La suma de `allVentasData` se mantiene igual.

```text
ventasMap = useMemo:
  map = new Map<peId, number>()
  para cada p en (proyectos || []):
    para cada pe en (p.proyecto_empresas || []):
      ppto = Number(pe.ganado_presupuesto) || 0
      si ppto !== 0: map.set(pe.id, ppto)
  para cada v en (allVentasData || []):
    map.set(v.proyecto_empresa_id,
            (map.get(v.proyecto_empresa_id) || 0) + Number(v.monto_uf))
  return map
```

Dependencias del `useMemo`: `[proyectos, allVentasData]` (ya no depende de `categorias` ni `latestHistorialByPe`).

Consumidores que se benefician automáticamente sin cambios: `EmpresasCell`, `GroupEmpresasCell` (agrega por `empresa_id` sumando los totales por PE), detalle expandido y cualquier KPI que lea `ventasMap`.

### Sin otros cambios

- `ProyectoFormDialog.ventasTotalByEmpresa`: ya aplica esta fórmula.
- `statusByPe` y badges de estado: siguen usando `latestHistorialByPe` (estado ≠ monto).
- `historial_estatus_empresa`: no se modifica; el popover de Historial sigue mostrando todas las entradas.
- `Finanzas.tsx` y `Dashboard.tsx`: usan `pe.monto_cotizacion`, que el formulario ya escribe igual a `ventasTotalByEmpresa` al guardar (línea 486 del form). Quedan consistentes con la nueva regla en cuanto el proyecto se guarde una vez. **No se tocan en este cambio**; si el usuario quiere que también respondan en vivo a `ventas_proyecto_empresa` sin re-guardar, lo hacemos en un paso aparte.

## Verificación tras el cambio

1. Empresa adjudicada con `ganado_presupuesto = 440,81` y sin adicionales → badge `440,81 UF`.
2. Empresa con `ganado_presupuesto = 1.000` y dos adicionales (500 + 481,82) → badge `1.981,82 UF` (igual al span seleccionado).
3. Empresa cuya última entrada del historial dice "Perdido" pero tiene `ganado_presupuesto = null` y 250 UF en adicionales → badge `250 UF`.
4. Fila madre: la suma agregada por empresa coincide con la suma de los badges hijos visibles.
5. El popover de Historial sigue mostrando todas las entradas (incluidas duplicadas) sin alterar el badge.
