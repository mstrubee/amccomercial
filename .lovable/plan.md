

## Mejoras de UX y Reglas de Negocio para el Repositorio

### Resumen
Aplicar 4 mejoras al sistema de repositorio: carpeta raiz automatica con nombre del proyecto, confirmacion de borrado mejorada, ordenamiento alfabetico A-Z, y estilo destructivo en el boton eliminar.

---

### 1. Carpeta Raiz Automatica con Nombre del Proyecto

**Archivo:** `src/hooks/useProjectFolders.ts` (funcion `useGenerateFromTemplate`)

Antes de insertar la estructura del template, crear primero una carpeta raiz con el nombre del proyecto. Todas las carpetas del template se insertan como hijas de esta carpeta raiz.

Cambios:
- La mutacion `useGenerateFromTemplate` ahora recibe `{ projectId, projectName }` en vez de solo `projectId`
- Primero inserta una carpeta raiz con `name = projectName`, `parent_id = null`
- Luego inserta el arbol del template como hijos de esa carpeta raiz

**Archivo:** `src/components/repositorio/ProyectoRepositorioDialog.tsx`
- Pasar `projectName` al llamar `generateMutation.mutateAsync({ projectId, projectName })`

### 2. Confirmacion de Borrado Mejorada

Los dialogs de confirmacion ya existen en ambos componentes. Solo se necesita actualizar el texto.

**Archivos:** `ProyectoRepositorioDialog.tsx` y `RepositorioTipoPage.tsx`
- Cambiar el texto de confirmacion a: "¿Estas seguro de eliminar esta carpeta? Se eliminaran tambien todas sus subcarpetas y este proceso no se puede deshacer."

El borrado local ya esta garantizado por la arquitectura: `ProyectoRepositorioDialog` solo opera sobre `project_folders` y `RepositorioTipoPage` solo sobre `folder_templates`. No se requieren cambios adicionales.

### 3. Ordenamiento Alfabetico A-Z

**Archivos:** `src/hooks/useFolderTemplates.ts` y `src/hooks/useProjectFolders.ts`

Cambiar las funciones `buildTree` y `buildProjectTree` para ordenar puramente por nombre alfabetico en vez de `orden` primero:

```
nodes.sort((a, b) => a.name.localeCompare(b.name));
```

Esto aplica recursivamente en todos los niveles del arbol. Como las queries ya invalidan el cache al crear/renombrar, el arbol se refresca automaticamente en orden correcto.

### 4. Estilo Destructivo en Boton Eliminar

**Archivo:** `src/components/repositorio/FolderTreeNode.tsx`

Cambiar el boton de eliminar para que el icono Trash2 tenga color rojo suave por defecto:

```tsx
<Trash2 className="w-3.5 h-3.5 text-destructive/70" />
```

Y agregar `hover:bg-destructive/10` al boton contenedor para reforzar visualmente.

---

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useProjectFolders.ts` | `useGenerateFromTemplate` recibe projectName, crea carpeta raiz con nombre del proyecto |
| `src/hooks/useFolderTemplates.ts` | Ordenar `buildTree` solo por nombre (A-Z) |
| `src/components/repositorio/ProyectoRepositorioDialog.tsx` | Pasar projectName a generate, actualizar texto de confirmacion |
| `src/pages/RepositorioTipoPage.tsx` | Actualizar texto de confirmacion de borrado |
| `src/components/repositorio/FolderTreeNode.tsx` | Estilo rojo suave en boton/icono de eliminar |

