

## Fix: Sincronizacion completa de carpetas de empresa y feedback al usuario

### Problema identificado

La logica de sincronizacion incremental (`useSyncTemplateToProject`) SI inserta carpetas nuevas de empresas correctamente en la base de datos local. Sin embargo, hay dos problemas:

1. **Sin sincronizacion a Google Drive**: Despues de que el sync de template inserta carpetas nuevas (como "Hunter"), no se dispara la sincronizacion con Google Drive. Las carpetas quedan solo localmente.
2. **Sin feedback al usuario**: El sync es silencioso -- no notifica cuantas carpetas nuevas se insertaron ni si hubo cambios, por lo que el usuario no sabe si funciono.
3. **Subcarpetas de empresa nueva**: Si "Hunter" tiene subcarpetas en el template (ej: "Presupuestos"), estas tambien deben crearse. La logica actual lo hace correctamente al recursionar, pero sin sync a Drive quedan invisibles en la nube.

### Cambios propuestos

#### 1. `ProyectoRepositorioDialog.tsx` -- Disparar Drive sync despues de template sync

Modificar el efecto de auto-sync de template (lineas 82-86) para que, si se insertaron carpetas nuevas, se dispare `triggerSync()` automaticamente y se muestre un toast informativo.

```typescript
// Cambiar de:
syncTemplateMutation.mutate({ projectId });

// A:
syncTemplateMutation.mutateAsync({ projectId }).then((result) => {
  if (result && (result.inserted > 0 || result.updated > 0)) {
    toast.info(`Repositorio actualizado: ${result.inserted} carpeta(s) agregada(s)`);
    triggerSync(); // Sincronizar nuevas carpetas con Drive
  }
});
```

#### 2. `useProjectFolders.ts` -- Mejorar robustez del sync

La logica actual tiene un bloque muerto en lineas 247-249 que no hace nada. Se limpiara para mayor claridad. La logica de filtrado de empresas es correcta pero se verificara que las subcarpetas de una empresa nueva se insertan recursivamente.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/repositorio/ProyectoRepositorioDialog.tsx` | Agregar triggerSync + toast despues de template sync exitoso |
| `src/hooks/useProjectFolders.ts` | Limpiar codigo muerto en lineas 247-249 para claridad |

### Resultado esperado

Al abrir el repositorio de un proyecto:
1. Se ejecuta el sync de template automaticamente
2. Si hay carpetas nuevas (como "Hunter" y sus subcarpetas), se insertan en la BD
3. Se muestra un toast informando los cambios
4. Se dispara la sincronizacion con Google Drive para crear las carpetas en la nube

