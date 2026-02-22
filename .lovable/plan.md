
# Promover y degradar categorias / subcategorias

## Objetivo
Permitir que una categoria se convierta en subcategoria de otra categoria, y que una subcategoria se promueva a categoria independiente. Todo desde la interfaz del administrador de categorias.

## Operaciones

### 1. Subcategoria -> Categoria (Promover)
- Se elimina la subcategoria de la tabla `subcategorias_proyecto`
- Se crea una nueva fila en `categorias_proyecto` con el mismo nombre, color, es_adjudicado, y boton_* 
- Se asigna el orden siguiente (max + 1) entre las categorias existentes

### 2. Categoria -> Subcategoria (Degradar)
- El usuario debe seleccionar bajo cual categoria madre quedara
- Se elimina la categoria de `categorias_proyecto`
- Se crea una nueva fila en `subcategorias_proyecto` con categoria_id apuntando a la madre elegida
- Se asigna el orden siguiente (max + 1) dentro de las subcategorias de esa madre
- Si la categoria tiene subcategorias propias, se impide la operacion (no se puede degradar una categoria que tenga hijas)

## Cambios en la interfaz (CategoriasManagerDialog.tsx)

### Botones nuevos
- En cada **subcategoria** (vista no-edicion): agregar un boton con icono de flecha arriba (ArrowUp) para "Promover a categoria"
- En cada **categoria** (vista no-edicion): agregar un boton con icono de flecha abajo (ArrowDown) para "Convertir en subcategoria". Solo visible si la categoria NO tiene subcategorias

### Flujo "Degradar categoria"
- Al hacer clic en ArrowDown, se muestra un pequeno selector (dropdown o popover) con las demas categorias disponibles como destino
- Al seleccionar una, se ejecuta la operacion

## Cambios en hooks (useCategorias.ts)

### usePromoteToCategoria
Nueva mutacion que:
1. Lee los datos de la subcategoria
2. Calcula max orden de categorias + 1
3. Inserta en `categorias_proyecto`
4. Elimina de `subcategorias_proyecto`

### useDemoteToSubcategoria
Nueva mutacion que:
1. Verifica que la categoria no tenga subcategorias
2. Lee los datos de la categoria
3. Calcula max orden de subcategorias del destino + 1
4. Inserta en `subcategorias_proyecto` con el `categoria_id` destino
5. Elimina de `categorias_proyecto`

## Detalle tecnico

- Las operaciones son de dos pasos (insert + delete). Si el insert falla, no se elimina nada. Si el delete falla, queda duplicado pero no se pierde dato.
- Los campos `permite_fecha` solo existen en `categorias_proyecto`, por lo que al degradar se pierde ese campo. Al promover, se inicializa como `false`.
- Los proyectos que referencien la categoria/subcategoria original quedaran apuntando a un ID que ya no existe. Esto se manejara con la logica existente (el campo queda null o se limpia).

## Archivos a modificar
1. **src/hooks/useCategorias.ts** - Agregar `usePromoteToCategoria` y `useDemoteToSubcategoria`
2. **src/components/proyectos/CategoriasManagerDialog.tsx** - Agregar botones de promover/degradar y el selector de categoria destino para la degradacion
