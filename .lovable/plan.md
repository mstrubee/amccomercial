

## Plan: Datos de "Ganado" al clasificar un proyecto

### Resumen

Cuando un usuario selecciona la subcategoria "Ganado" para una empresa en un proyecto, el sistema abrira un dialogo para ingresar **Presupuesto** (numero), **OP** (texto) y **Fecha** (por defecto hoy). Estos datos se almacenan en `proyecto_empresas` y son editables/eliminables posteriormente.

---

### 1. Migracion de base de datos

Agregar 3 columnas a la tabla `proyecto_empresas`:

```text
ganado_presupuesto  | numeric  | nullable | default null
ganado_op           | text     | nullable | default null
ganado_fecha        | date     | nullable | default null
```

No se requieren nuevas politicas RLS ya que las existentes cubren las operaciones sobre `proyecto_empresas`.

---

### 2. Cambios en tipos y hooks

**`src/hooks/useProyectos.ts`**:
- Agregar `ganado_presupuesto`, `ganado_op`, `ganado_fecha` al tipo `EmpresaLink`
- Incluir estos campos en los `insert`/`upsert` de `proyecto_empresas` en `useCreateProyecto` y `useUpdateProyecto`

---

### 3. Dialog "Datos de Ganado" en ProyectoFormDialog

**`src/components/proyectos/ProyectoFormDialog.tsx`**:

- Agregar `ganado_presupuesto`, `ganado_op`, `ganado_fecha` al tipo `EmpresaRow`
- En `handleCategoryChange`: cuando la nueva subcategoria es "Ganado" (`5ede8de9-...`), abrir un dialog interno para capturar los datos antes de confirmar el cambio
- El dialog contiene:
  - Input numerico "Presupuesto" (en UF, con conversion CLP)
  - Input texto "OP"
  - Input date "Fecha" (por defecto: hoy)
  - Botones Cancelar (revierte la seleccion) y Confirmar
- Si el usuario cancela, la categoria vuelve al valor anterior
- Cuando la categoria deja de ser "Ganado", los campos se limpian automaticamente

**Visualizacion inline**: Cuando una empresa ya tiene datos de Ganado, mostrar los valores debajo del selector de categoria (Presupuesto, OP, Fecha) con posibilidad de editar (abre el mismo dialog) o limpiar los datos.

---

### 4. Propagacion al submit

En `handleSubmit`, incluir `ganado_presupuesto`, `ganado_op`, `ganado_fecha` en el objeto `empresa_links` que se envia al hook de creacion/actualizacion.

---

### Seccion tecnica

- La constante `GANADO_SUBCATEGORIA_ID = "5ede8de9-4fd3-4670-85d5-4934af648e74"` se usara para detectar cuando se selecciona "Ganado"
- Los datos se persisten en `proyecto_empresas` junto con los demas campos comerciales
- El dialog es un componente interno del `ProyectoFormDialog` (no un componente separado) para simplicidad
- Los campos se inicializan desde `initialData.proyecto_empresas` al abrir el formulario en modo edicion

