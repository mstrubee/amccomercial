

## Deduplicar alertas en la vista de Proyectos

### Problema
Cuando los proyectos se agrupan por nombre, el grupo contiene multiples IDs de proyecto. Las alertas cargadas masivamente se crearon con diferentes `proyecto_id` pero con el mismo contenido (titulo, texto, fecha, empresa), causando duplicados visuales tanto en la linea madre como en las filas de empresa.

### Solucion
Agregar una funcion de deduplicacion que filtre alertas con contenido identico, conservando solo una por cada combinacion unica de `titulo + texto + fecha_seguimiento + empresa_id`. Esto replica el comportamiento esperado de la Central de Alertas donde cada alerta aparece una sola vez.

### Detalle tecnico

**Archivo: `src/pages/Proyectos.tsx`**

1. Crear una funcion auxiliar `deduplicateAlertas` que:
   - Recibe un array de alertas
   - Genera una clave unica por cada alerta usando `titulo|texto|fecha_seguimiento|empresa_id`
   - Conserva solo la primera alerta de cada clave (la mas antigua por `created_at`)
   - Retorna el array deduplicado

2. Aplicar la deduplicacion en dos lugares:
   - **Linea madre** (linea ~447): despues de filtrar `parentAlertasRaw`, aplicar `deduplicateAlertas` antes de pasar a `AlertasFullView`
   - **Filas hijas** (linea ~503): despues de filtrar `childAlertas`, aplicar la misma deduplicacion antes de pasar a `AlertasCollapsible` y al popover de empresa

```text
Antes:
  alertas DB --> filtrar por proyecto_id + empresa_id --> mostrar (con duplicados)

Despues:
  alertas DB --> filtrar por proyecto_id + empresa_id --> deduplicar por contenido --> mostrar (sin duplicados)
```

La deduplicacion se hace solo a nivel visual, sin modificar datos en la base de datos.
