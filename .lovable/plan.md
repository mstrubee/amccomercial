

## Contactos separados por fila al agregar clientes

### Contexto actual
Cada seccion de contacto (Arquitectura, Constructora, ITO, Duenos) tiene 4 campos de texto (Nombre, Contacto, Email, Telefono). Cuando se agrega un segundo cliente, los valores se concatenan en el mismo campo con " / " como separador (ej: "Juan / Pedro").

### Cambio solicitado
Al agregar un nuevo cliente, se deben crear **4 casillas nuevas** (una fila completa) debajo de la fila existente, en lugar de concatenar los datos en las mismas casillas.

### Enfoque tecnico

La base de datos almacena estos campos como texto plano (ej: `arq_nombre`, `arq_contacto`, etc.). Para mantener compatibilidad sin migrar la BD, se usara el separador " / " internamente pero la UI mostrara filas separadas.

**Cambios en `src/components/proyectos/ProyectoFormDialog.tsx`:**

1. **Reemplazar la estructura de `sections`** para que cada seccion maneje un arreglo de entradas en vez de 4 valores escalares. Al cargar datos existentes (que usan " / "), se hara split para generar las filas.

2. **Modificar `ContactosSection`** para:
   - Convertir los 4 strings (nombre/contacto/mail/telefono) en un arreglo de objetos `{ nombre, contacto, mail, telefono }` usando `.split(" / ")`.
   - Renderizar una fila de 4 inputs por cada entrada del arreglo.
   - Incluir un boton para eliminar filas individuales (excepto la primera).
   - Al modificar cualquier input, reconstruir el string concatenado con " / " y llamar al setter correspondiente.

3. **Modificar `applyCliente`** para que en vez de concatenar, agregue una nueva fila (append al arreglo), lo que genera un nuevo grupo de 4 inputs.

4. **Al guardar**, las filas se unen con " / " para cada campo, manteniendo la compatibilidad con la BD y con `ProyectoInput`.

### Ejemplo visual

Antes (un solo cliente):
```text
| Nombre: Juan  | Contacto: J. Perez |
| Email: j@x.co | Telefono: 123      |
```

Despues de agregar otro cliente:
```text
| Nombre: Juan  | Contacto: J. Perez |
| Email: j@x.co | Telefono: 123      |
| Nombre: Pedro | Contacto: P. Lopez |  <-- fila nueva
| Email: p@x.co | Telefono: 456      |
```

### Archivos a modificar

- `src/components/proyectos/ProyectoFormDialog.tsx` - Unico archivo a modificar. Se cambia la logica interna de `ContactosSection` y `applyCliente`. No hay cambios en la BD ni en otros componentes.

