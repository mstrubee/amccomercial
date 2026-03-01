

## Objetivo

Eliminar la creacion automatica de una carpeta raiz con el nombre del proyecto al generar desde el Repositorio Tipo. Las carpetas del template deben insertarse directamente como carpetas raiz del proyecto (sin carpeta contenedora). La carpeta con el nombre del proyecto solo debe existir en Google Drive al momento de sincronizar.

## Cambio

### `src/hooks/useProjectFolders.ts` - funcion `useGenerateFromTemplate`

Actualmente la funcion:
1. Crea una carpeta raiz con `name: projectName`
2. Inserta todo el arbol de templates como hijos de esa carpeta

El cambio consiste en:
1. **Eliminar** la creacion de la carpeta raiz con el nombre del proyecto (lineas 119-126)
2. Llamar `insertRecursive(tree, null)` en lugar de `insertRecursive(tree, rootId)` para que las carpetas del template queden como carpetas raiz directas del proyecto

### Codigo resultante (simplificado)

```typescript
// Antes:
const rootFolder = await insert({ name: projectName, ... });
await insertRecursive(tree, rootFolder.id);

// Despues:
await insertRecursive(tree, null);  // carpetas del template van directo a la raiz
```

### Detalles tecnicos

- No se requieren cambios en la base de datos
- No se requieren cambios en el backend/Edge Functions
- La carpeta con nombre del proyecto en Google Drive ya se crea en la funcion `sync-drive` al sincronizar, por lo que ese comportamiento se mantiene sin cambios
- Solo se modifica un archivo: `src/hooks/useProjectFolders.ts`

