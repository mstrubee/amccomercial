

## Ampliar la busqueda en Central de Alertas

### Problema actual
El campo de busqueda en la Central de Alertas solo filtra por texto de la alerta, titulo, nombre del proyecto y nombre de la empresa. No permite buscar por nombre del responsable ni por cliente vinculado al proyecto.

### Solucion
Extender el filtro de busqueda para incluir dos campos adicionales:

1. **Responsable**: buscar por `display_name` o `email` del usuario responsable (datos ya disponibles en `responsable_profile` de cada alerta y en la lista `profiles`).
2. **Cliente**: buscar por nombre del cliente vinculado al proyecto de la alerta (datos disponibles en `proyectosRaw` que ya incluye `proyecto_clientes`).

### Detalles tecnicos

**Archivo:** `src/pages/Alertas.tsx`

**Cambio 1 - Ampliar logica de filtro (lineas 217-225):**

Agregar al filtro de busqueda:
- `a.responsable_profile?.display_name` y `a.responsable_profile?.email` para buscar por responsable
- Cruzar `a.proyecto_id` con `proyectosRaw` para obtener los clientes vinculados y buscar por sus nombres

```typescript
if (search.trim()) {
  const s = search.toLowerCase();
  list = list.filter((a) =>
    a.texto.toLowerCase().includes(s) ||
    ((a as any).titulo || "").toLowerCase().includes(s) ||
    a.proyectos?.nombre?.toLowerCase().includes(s) ||
    a.empresas?.nombre?.toLowerCase().includes(s) ||
    a.responsable_profile?.display_name?.toLowerCase().includes(s) ||
    a.responsable_profile?.email?.toLowerCase().includes(s) ||
    proyectosRaw?.some(p => 
      p.id === a.proyecto_id && 
      p.proyecto_clientes?.some(pc => 
        pc.clientes?.nombre?.toLowerCase().includes(s)
      )
    )
  );
}
```

**Cambio 2 - Actualizar placeholder del input (linea 510):**

Cambiar el placeholder de `"Buscar alertas..."` a `"Buscar proyecto, alerta, responsable o cliente..."` para indicar al usuario las opciones de busqueda disponibles.

**Cambio 3 - Actualizar dependencias del useMemo (linea 233):**

Agregar `proyectosRaw` a las dependencias del `useMemo` del filtrado, ya que ahora se usa para buscar clientes. (Nota: `proyectosRaw` probablemente ya esta en las dependencias o se usa indirectamente; verificar y agregar si falta.)

