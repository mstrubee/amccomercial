

## Repositorio filtrado por empresa + Repositorio Comun

### Objetivo
Permitir que cada fila de empresa en el listado de proyectos muestre un repositorio filtrado con:
1. Su carpeta específica dentro de `Empresas/[NombreEmpresa]`
2. Las carpetas marcadas como "Repositorio Comun" (ej: `Planos`)

Las carpetas NO marcadas como comun solo se muestran en la linea madre del proyecto.

### Cambios necesarios

#### 1. Agregar columna `is_repo_comun` a `folder_templates`
Agregar un campo booleano a la tabla de plantillas para indicar cuales carpetas raiz son "Repositorio Comun". Por defecto `false`.

```sql
ALTER TABLE folder_templates ADD COLUMN is_repo_comun boolean NOT NULL DEFAULT false;
```

Tambien propagar a `project_folders`:
```sql
ALTER TABLE project_folders ADD COLUMN is_repo_comun boolean NOT NULL DEFAULT false;
```

#### 2. UI en Repositorio Tipo para marcar carpetas como "Comun"
En la pagina `RepositorioTipoPage.tsx`, agregar un checkbox o toggle en cada carpeta raiz (nivel 0) que permita marcar/desmarcar como "Repositorio Comun". Solo aplica a carpetas raiz.

Se agregara al componente `FolderTreeNode` una prop opcional `onToggleComun` y `isRepoComun` que muestre un icono/checkbox solo en nivel 0.

#### 3. Propagar `is_repo_comun` al generar repositorios de proyecto
En `useProjectFolders.ts`, en la funcion `useGenerateFromTemplate`, copiar el valor de `is_repo_comun` de cada template raiz a la carpeta del proyecto correspondiente.

#### 4. Boton de repositorio en filas de empresa
En `Proyectos.tsx`, en cada fila de empresa (child row), agregar un boton de carpeta (similar al de la linea madre) que abra el `ProyectoRepositorioDialog` pero con un filtro por empresa.

#### 5. Filtrar el arbol en `ProyectoRepositorioDialog`
Agregar props opcionales al dialogo:
- `filterEmpresaName?: string` - nombre de la empresa para filtrar
- Cuando se proporciona, el arbol mostrado sera:
  - Carpetas raiz marcadas como `is_repo_comun = true` (con todo su contenido)
  - La subcarpeta `Empresas/[filterEmpresaName]` (con todo su contenido)
  - Se excluyen las demas carpetas raiz y las demas subcarpetas de "Empresas"
- Cuando NO se proporciona (linea madre), se muestra todo el arbol completo como ahora

La logica de filtrado se aplicara sobre el arbol ya construido, sin crear carpetas nuevas. Es puramente visual.

#### 6. Modo lectura en filas de empresa
El repositorio abierto desde una fila de empresa sera de solo lectura (sin crear/renombrar/eliminar carpetas), ya que la gestion completa se hace desde la linea madre. Se reutilizara la prop `canEdit` existente.

### Resumen tecnico de archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | Agregar `is_repo_comun` a `folder_templates` y `project_folders` |
| `src/hooks/useFolderTemplates.ts` | Agregar campo al tipo, crear hook para toggle |
| `src/hooks/useProjectFolders.ts` | Propagar `is_repo_comun` en generacion, agregar al tipo, funcion de filtrado |
| `src/components/repositorio/FolderTreeNode.tsx` | Prop opcional para toggle de "Comun" en nivel 0 |
| `src/pages/RepositorioTipoPage.tsx` | Pasar callbacks de toggle al tree |
| `src/components/repositorio/ProyectoRepositorioDialog.tsx` | Aceptar `filterEmpresaName`, filtrar arbol |
| `src/pages/Proyectos.tsx` | Agregar boton repositorio en filas de empresa, nuevo state para target con empresa |

