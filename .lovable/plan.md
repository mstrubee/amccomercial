

## Hacer "Estado (x Proyecto)" administrable por el Admin

### Problema actual
Los valores de "Estado AMC" (ahora llamado "Estado (x Proyecto)") estan hardcodeados en dos archivos:
- `src/pages/Proyectos.tsx` linea 50: `["Todos", "Vigente", "Todo Ofrecido", "Sin Respuesta", "Descartado"]`
- `src/components/proyectos/ProyectoFormDialog.tsx` linea 41: `["Vigente", "Descartado", "Todo Ofrecido", "Sin Respuesta"]`

### Cambios planificados

#### 1. Nueva tabla en la base de datos: `estados_proyecto`

```sql
CREATE TABLE public.estados_proyecto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estados_proyecto ENABLE ROW LEVEL SECURITY;

-- Lectura para todos los autenticados
CREATE POLICY "Authenticated can read estados_proyecto"
  ON public.estados_proyecto FOR SELECT USING (true);

-- CRUD completo solo para admins
CREATE POLICY "Admins can manage estados_proyecto"
  ON public.estados_proyecto FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insertar los 4 valores por defecto
INSERT INTO public.estados_proyecto (nombre, orden) VALUES
  ('Vigente', 1),
  ('Descartado', 2),
  ('Todo Ofrecido', 3),
  ('Sin Respuesta', 4);
```

#### 2. Nuevo hook: `src/hooks/useEstadosProyecto.ts`
Hook con funciones CRUD (similar a `useCategorias`):
- `useEstadosProyecto()` - leer todos ordenados por `orden`
- `useCreateEstadoProyecto()` - crear
- `useUpdateEstadoProyecto()` - editar nombre
- `useDeleteEstadoProyecto()` - eliminar

#### 3. Nueva pagina: `src/pages/EstadosProyectoPage.tsx`
Interfaz simple de administracion con lista de estados, botones para agregar, editar (inline) y eliminar con confirmacion. Similar en estilo a la pagina de Categorias pero mas sencilla (sin subcategorias ni colores).

#### 4. Agregar ruta y menu de navegacion

**`src/App.tsx`**: Agregar ruta `/estados-proyecto` protegida para admin.

**`src/components/layout/AppLayout.tsx`**: Agregar entrada en `allAdminSubItems` entre "Estatus" y "Reporteria":
```text
Clientes y Captadores
Estatus
Estado (x Proyecto)   <-- NUEVO
Reporteria
Usuarios
Empresas
Carga Masiva
```

#### 5. Actualizar componentes que usan estados hardcodeados

**`src/pages/Proyectos.tsx`**: Reemplazar la constante `ESTADOS_AMC` por los datos del hook `useEstadosProyecto()`. El filtro popover mostrara los valores dinamicos de la BD.

**`src/components/proyectos/ProyectoFormDialog.tsx`**: Reemplazar la constante `ESTADOS_AMC` por los datos del hook. El select de estado en el formulario mostrara opciones dinamicas.

### Archivos a crear
- `src/hooks/useEstadosProyecto.ts`
- `src/pages/EstadosProyectoPage.tsx`

### Archivos a modificar
- `src/App.tsx` (agregar ruta)
- `src/components/layout/AppLayout.tsx` (agregar item al menu admin)
- `src/pages/Proyectos.tsx` (usar hook en vez de constante)
- `src/components/proyectos/ProyectoFormDialog.tsx` (usar hook en vez de constante)

### Migracion de base de datos
- Crear tabla `estados_proyecto` con RLS y datos iniciales
