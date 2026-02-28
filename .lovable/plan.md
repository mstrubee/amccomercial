

## Sistema de Repositorio de Carpetas Jerárquico

### Resumen
Implementar un sistema de gestión de archivos con dos niveles: un "Repositorio Tipo" (plantilla maestra administrada por admins) y "Repositorios de Proyecto" (instancias independientes por proyecto). Incluye interfaz de árbol recursivo con operaciones CRUD.

---

### 1. Migración de Base de Datos

**Tabla `folder_templates`** (Repositorio Tipo):
- `id` (uuid, PK), `name` (text), `parent_id` (uuid, FK self-referencing, nullable)
- `orden` (integer, default 0) para ordenar carpetas hermanas
- RLS: admins CRUD, authenticated SELECT

**Tabla `project_folders`** (Repositorios de Proyecto):
- `id` (uuid, PK), `name` (text), `project_id` (uuid, FK a proyectos.id)
- `parent_id` (uuid, FK self-referencing, nullable)
- `template_id` (uuid, FK a folder_templates.id, nullable)
- `drive_folder_id` (text, nullable)
- `orden` (integer, default 0)
- RLS: authenticated SELECT, admins y tipo1 INSERT/UPDATE, admins DELETE
- ON DELETE CASCADE en `project_id` para limpiar al eliminar proyecto

```sql
CREATE TABLE public.folder_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.folder_templates(id) ON DELETE CASCADE,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.project_folders(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.folder_templates(id) ON SET NULL,
  drive_folder_id text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

RLS policies para ambas tablas siguiendo el patrón existente (admins manage, authenticated read). Para `project_folders`, admins y tipo1 pueden insertar/actualizar, solo admins pueden eliminar.

---

### 2. Hook `useFolderTemplates`

Nuevo archivo: `src/hooks/useFolderTemplates.ts`

- `useFolderTemplates()` - query que lee todas las `folder_templates` ordenadas
- `useCreateFolderTemplate()` - mutation para crear carpeta
- `useUpdateFolderTemplate()` - mutation para renombrar
- `useDeleteFolderTemplate()` - mutation para eliminar (cascada automática por FK)
- Helper `buildTree(flatList)` que convierte la lista plana en estructura de arbol anidada

### 3. Hook `useProjectFolders`

Nuevo archivo: `src/hooks/useProjectFolders.ts`

- `useProjectFolders(projectId)` - query que lee carpetas de un proyecto
- `useCreateProjectFolder()` - mutation para crear
- `useUpdateProjectFolder()` - mutation para renombrar
- `useDeleteProjectFolder()` - mutation para eliminar
- `useGenerateFromTemplate(projectId)` - mutation que copia toda la estructura de `folder_templates` a `project_folders`, mapeando parent_ids correctamente y asignando `template_id`

---

### 4. Componente `FolderTreeNode` (Recursivo)

Nuevo archivo: `src/components/repositorio/FolderTreeNode.tsx`

Componente reutilizable que renderiza un nodo de carpeta con:
- Icono Folder/FolderOpen + ChevronRight rotable
- Indentación visual por nivel (padding-left proporcional)
- Botones inline: "Agregar Subcarpeta" (FolderPlus), "Renombrar" (Pencil), "Eliminar" (Trash2)
- Renderizado recursivo de hijos
- Usa Collapsible de shadcn para expandir/colapsar
- Input inline para crear/renombrar (sin diálogo extra)

---

### 5. Página "Repositorio Tipo" (Admin)

Nuevo archivo: `src/pages/RepositorioTipoPage.tsx`

- Titulo "Repositorio Tipo" con descripcion
- Boton "Nueva Carpeta Raiz" en la parte superior
- Arbol recursivo usando `FolderTreeNode` con datos de `folder_templates`
- AlertDialog de confirmacion al eliminar con advertencia de borrado en cascada
- Solo accesible por admins

**Ruta**: `/repositorio-tipo` en `App.tsx` (admin only)

**Sidebar**: Agregar "Repositorio Tipo" a `allAdminSubItems` en `AppLayout.tsx`

---

### 6. Dialog "Repositorio del Proyecto"

Nuevo archivo: `src/components/repositorio/ProyectoRepositorioDialog.tsx`

Dialog que se abre desde la vista de proyectos (boton en cada grupo de proyecto):
- Si el proyecto no tiene carpetas: muestra boton "Generar desde Repositorio Tipo"
- Si ya tiene carpetas: muestra el arbol con las mismas funcionalidades CRUD
- Los cambios solo afectan `project_folders` del proyecto seleccionado
- Boton para abrir este dialog se agrega en la fila madre de cada grupo en Proyectos.tsx (icono Folder)

---

### 7. Integración en Proyectos.tsx

- Agregar un boton con icono `FolderKanban` en cada fila madre del listado de proyectos
- Al hacer clic abre `ProyectoRepositorioDialog` pasando el `project_id` del primer proyecto del grupo
- Estado `repositorioTarget` para controlar que proyecto tiene el dialog abierto

---

### Archivos a crear/modificar

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | Crear tablas `folder_templates` y `project_folders` con RLS |
| `src/hooks/useFolderTemplates.ts` | Nuevo - CRUD + buildTree helper |
| `src/hooks/useProjectFolders.ts` | Nuevo - CRUD + generacion desde template |
| `src/components/repositorio/FolderTreeNode.tsx` | Nuevo - componente recursivo de arbol |
| `src/pages/RepositorioTipoPage.tsx` | Nuevo - pagina admin del repositorio tipo |
| `src/components/repositorio/ProyectoRepositorioDialog.tsx` | Nuevo - dialog de repositorio por proyecto |
| `src/App.tsx` | Agregar ruta `/repositorio-tipo` |
| `src/components/layout/AppLayout.tsx` | Agregar "Repositorio Tipo" al menu admin |
| `src/pages/Proyectos.tsx` | Agregar boton + dialog de repositorio por proyecto |

