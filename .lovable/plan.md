

## Sincronizacion inteligente entre Repositorio Tipo y Proyectos

### Problema actual
1. Al generar carpetas desde el Repositorio Tipo, se copian TODAS las carpetas, incluyendo subcarpetas de empresas que no participan en el proyecto.
2. Si despues se modifica el Repositorio Tipo (nueva carpeta, cambio de "Comun"), los proyectos existentes no se actualizan.

### Solucion propuesta

#### 1. Generacion inteligente filtrada por empresas del proyecto

Al ejecutar "Generar desde Repositorio Tipo", el sistema:
- Consultara las empresas vinculadas al proyecto (tabla `proyecto_empresas` + `empresas`)
- Recorrera el arbol de plantillas y, al llegar a la carpeta raiz "Empresas", solo creara las subcarpetas cuyo nombre coincida con una empresa del proyecto
- Las demas carpetas raiz (comunes o no) se copian normalmente

**Archivo**: `src/hooks/useProjectFolders.ts` — modificar `useGenerateFromTemplate`

#### 2. Sincronizacion incremental del Repositorio Tipo

Se creara una nueva funcion/hook `useSyncTemplateToProject` que:
- Compara las carpetas del template (`folder_templates`) con las del proyecto (`project_folders` via `template_id`)
- Identifica carpetas nuevas en el template que no existen en el proyecto
- Las inserta en la posicion correcta del arbol del proyecto
- Respeta la logica de filtrado: solo agrega subcarpetas de "Empresas" si la empresa existe en el proyecto
- Actualiza el flag `is_repo_comun` en carpetas existentes si cambio en el template

Esta sincronizacion se ejecutara:
- Automaticamente al abrir el repositorio de un proyecto (si ya tiene carpetas)
- Con un boton manual "Sincronizar con Repositorio Tipo" visible en el dialogo del repositorio

**Archivo**: `src/hooks/useProjectFolders.ts` — nueva funcion `useSyncTemplateToProject`

#### 3. Actualizacion del dialogo de repositorio

El `ProyectoRepositorioDialog` llamara a la sincronizacion incremental al abrirse (si el proyecto ya tiene carpetas), asegurando que cualquier cambio en el template se refleje automaticamente.

**Archivo**: `src/components/repositorio/ProyectoRepositorioDialog.tsx`

### Detalle tecnico

```text
Flujo de generacion (mejorado):
Template Tree          Empresas del proyecto
    |                       |
    v                       v
 [Planos]              [Endemik, Vidrios Chile]
 [Empresas]
   [Endemik]    <-- match -> se crea
   [Otra Co]    <-- no match -> se omite
   [Vidrios Chile] <-- match -> se crea
```

```text
Flujo de sincronizacion incremental:
Template folders (por template_id)   vs   Project folders (por template_id)
         |                                        |
         v                                        v
  Nuevos en template?  -----> Insertar en proyecto
  is_repo_comun cambio? ----> Actualizar en proyecto
  Solo empresas del proyecto se consideran
```

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useProjectFolders.ts` | Filtrar empresas en generacion; nueva funcion `useSyncTemplateToProject` |
| `src/components/repositorio/ProyectoRepositorioDialog.tsx` | Llamar sync incremental al abrir; pasar empresas del proyecto |

### Consideraciones
- La sincronizacion es aditiva (no elimina carpetas del proyecto que ya no estan en el template)
- Si se agrega una nueva empresa al proyecto despues de generar, el usuario puede re-sincronizar para crear su carpeta
- El `template_id` en `project_folders` es la clave para mapear que carpetas del template ya existen en el proyecto
