
# Mejorar el dialogo de completar alerta

## Resumen
Al marcar una alerta como completada, el dialogo emergente mostrara:
1. Un resumen de la alerta que se esta completando (memoria visual) en la zona superior
2. La categoria comercial actual de la empresa en ese proyecto
3. Una sugerencia para avanzar a la siguiente categoria comercial, que el usuario puede aprobar o editar

## Secuencia de categorias comerciales actuales

```text
Pendiente (orden 1)
  1. Ofrecer para cotizar
  2. Sin cotizar, en EV

Contactado (orden 2)
  1. Ofrecido para cotizar
  2. Planos Solicitados
  4. Planos Existentes
  5. Planos Recibidos

Cotizacion (orden 3)
  1. Presupuesto Solicitado
  2. Cotizado Empresa
  3. Enviado a Cliente

Negociacion (orden 5)
  (sin subcategorias)

Cerrado (orden 6)
  1. Ganado
  2. Perdido
  3. Descartado
  4. Atiende Directo
```

## Cambios necesarios

### 1. Nueva funcion utilitaria: `getNextCategoriaComercial`
**Archivo:** `src/lib/clasificacion-utils.ts`

Funcion analoga a `getNextClasificacion` pero para categorias comerciales (`categorias_proyecto` / `subcategorias_proyecto`). Recibe la categoria y subcategoria actuales mas la lista completa de categorias con sus subs, y retorna el siguiente paso logico.

### 2. CompleteAlertaDialog.tsx - Rediseno del modo "complete"

**Zona superior - Resumen de la alerta:**
- Cuadro destacado (fondo suave) mostrando titulo, texto, proyecto, empresa y fecha de la alerta que se completa. Sirve como recordatorio visual.

**Zona media - Categoria comercial de la empresa:**
- Solo se muestra si la alerta tiene `proyecto_id` y `empresa_id`.
- Se consulta la tabla `proyecto_empresas` para obtener la `categoria_id` y `subcategoria_id` actual de esa empresa en ese proyecto.
- Se muestra la categoria actual con su color.
- Se sugiere la siguiente categoria con un selector (Select) pre-seleccionado en el "paso siguiente". El usuario puede cambiar a cualquier otra categoria/subcategoria o dejarlo sin cambio.
- Un checkbox o toggle "Avanzar categoria" (activado por defecto) para que el usuario pueda desactivar el avance si no desea cambiar la categoria.

**Zona inferior - Botones (sin cambio):**
- "Solo completar" y "Completar y crear nueva" siguen funcionando igual, pero ahora si el avance de categoria esta activo, tambien actualizan la `proyecto_empresas`.

### 3. Props adicionales en CompleteAlertaDialog

Nuevas props necesarias:
- `categorias`: lista de `CategoriaWithSubs[]` (del hook `useCategorias`)
- `onAdvanceCategoria`: callback opcional `(proyectoId: string, empresaId: string, categoriaId: string, subcategoriaId: string | null) => void` para actualizar la categoria comercial

### 4. Alertas.tsx - Pasar datos de categorias

- Importar `useCategorias` y pasar la data como prop al `CompleteAlertaDialog`.
- Crear un handler `handleAdvanceCategoria` que haga el update a `proyecto_empresas` con la nueva `categoria_id` / `subcategoria_id`.
- Invalidar queries de `proyecto-empresas-categorias` y `proyectos` tras el update.

### 5. Proyectos.tsx y AlertaWidget.tsx

Mismo patron: pasar `categorias` y `onAdvanceCategoria` al `CompleteAlertaDialog` desde estos componentes.

## Detalle tecnico

### Funcion `getNextCategoriaComercial`
```text
Input:  categoriaId, subcategoriaId, categorias[]
Output: { categoriaId, subcategoriaId }

Logica identica a getNextClasificacion:
1. Buscar la categoria actual en la lista ordenada
2. Si hay subcategoria actual, buscar la siguiente sub del mismo padre
3. Si es la ultima sub, pasar a la primera sub de la siguiente categoria
4. Si no hay sub, pasar a la siguiente categoria
```

### Update de proyecto_empresas
```text
supabase
  .from("proyecto_empresas")
  .update({ categoria_id, subcategoria_id })
  .eq("proyecto_id", proyectoId)
  .eq("empresa_id", empresaId)
```

### UI del selector de categoria sugerida
El selector mostrara todas las categorias y subcategorias disponibles (como el selector de clasificacion de alertas, con subcategorias indentadas). Estara pre-seleccionado en el "paso siguiente" calculado. El usuario puede:
- Dejarlo como esta (avanza automaticamente)
- Cambiarlo a otra categoria
- Desactivar el avance (checkbox)

## Archivos a modificar
1. `src/lib/clasificacion-utils.ts` - Agregar `getNextCategoriaComercial`
2. `src/components/alertas/CompleteAlertaDialog.tsx` - Redisenar con resumen, categoria comercial y selector
3. `src/pages/Alertas.tsx` - Pasar categorias y handler de avance
4. `src/pages/Proyectos.tsx` - Pasar categorias y handler de avance
5. `src/components/alertas/AlertaWidget.tsx` - Pasar categorias y handler de avance
