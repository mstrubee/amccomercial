## Problema

El badge de "Gran Total" en `src/pages/Proyectos.tsx` está sumando **todas** las entradas adjudicadas del historial (Ganado y otras), lo que infla el total cuando el usuario edita una misma categoría varias veces.

Ejemplo verificado:
- JACIMA en "Casa MR" tiene dos entradas Ganado en el historial (440,81 y 512,78 UF) y `ganado_presupuesto = 440,81`.
- El formulario de edición ya muestra correctamente `Gran Total: 440,81 UF` (última entrada vigente + 0 ventas adicionales).
- El badge de la lista muestra `953,59 UF` (suma de ambas).

## Regla acordada

Para cada `proyecto_empresa`, el Gran Total debe ser:

```
GranTotal[pe.id] = monto_uf de la ÚLTIMA entrada del historial cuya
                   categoría/subcategoría es adjudicada
                 + Σ monto_uf de ventas_proyecto_empresa[pe.id]
```

- "Última" = ordenada por `fecha` desc, desempatando por `created_at` desc (mismo criterio ya usado por `latestHistorialByPe`, fuente de verdad del estado).
- Si la última entrada del historial **no** es adjudicada, su aporte al Gran Total es `0` (solo se suman ventas adicionales).
- Esto también deduplica de forma natural el caso "dos estados iguales": solo cuenta la más reciente.
- Es exactamente la misma lógica que ya aplica el formulario de edición vía `ganado_presupuesto + ventas adicionales`, por lo que ambos lados quedan consistentes.

## Cambio puntual (solo presentación)

### Archivo: `src/pages/Proyectos.tsx` — `ventasMap` (líneas 405-428)

Reemplazar el bucle que suma todas las entradas adjudicadas por uno que use `latestHistorialByPe` (ya existente, líneas 292-302):

```text
ventasMap = useMemo:
  para cada (peId, latest) en latestHistorialByPe:
    si latest tiene subcategoria_id en adjSub  ó
       (sin subcategoria) categoria_id en adjCat:
         monto = Number(latest.monto_uf) || 0
         si monto > 0: map.set(peId, monto)

  para cada v en allVentasData:
    map.set(v.proyecto_empresa_id,
            (map.get(...) || 0) + Number(v.monto_uf))

  return map
```

Dependencias del `useMemo`: `[categorias, latestHistorialByPe, allVentasData]`.

No se tocan firmas ni componentes consumidores (`EmpresasCell`, `GroupEmpresasCell`, detalle expandido, KPIs que ya leen `ventasMap`). El `GroupEmpresasCell` ya agrega por `empresa_id` sumando los totales por PE; con la nueva regla, sigue funcionando.

### Sin otros cambios

- No se modifica el formulario (`ProyectoFormDialog`), ya cumple la regla.
- No se tocan tablas, RLS, mutaciones ni el cálculo de `statusByPe` / badges de estado.
- No se altera `historial_estatus_empresa` (las entradas duplicadas siguen visibles en el popover de Historial; solo cambia el cómputo del Gran Total).

## Verificación tras el cambio

1. JACIMA en "Casa MR" → badge debe mostrar `440,81 UF`.
2. Una empresa con ventas adicionales en `ventas_proyecto_empresa` debe mostrar `monto_último_ganado + Σ adicionales`.
3. Una empresa cuya última entrada del historial es **No Adjudicado** (p. ej. "Perdido") y tiene ventas adicionales debe mostrar solo el subtotal de adicionales.
4. KPIs y agregados de fila madre deben coincidir con la suma de los badges hijos visibles.
