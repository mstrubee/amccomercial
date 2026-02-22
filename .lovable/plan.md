

## Feature 1: Mostrar proyectos vinculados en el detalle del cliente

### Cambios en `src/components/clientes/ClienteDetailDialog.tsx`

- Importar `useProyectos` desde `@/hooks/useProyectos` y `useNavigate` desde `react-router-dom`
- Usar `useProyectos()` para obtener todos los proyectos
- Con un `useMemo`, filtrar los proyectos donde `proyecto_clientes` contenga el `cliente.id`
- Agregar una seccion "Proyectos Vinculados" despues de los contactos (antes de los botones de accion)
- Cada proyecto se muestra como una tarjeta clickeable con:
  - Nombre del proyecto
  - Categoria comercial (obtenida de `proyecto_empresas[0].categorias_proyecto.nombre` si existe)
  - Al hacer clic, navega a `/proyectos?highlight={proyecto.id}` y cierra el dialog

### UI

```
Proyectos Vinculados
+------------------------------------+
| Proyecto ABC                       |
| Categoria: En Estudio              |
+------------------------------------+
| Proyecto XYZ                       |
| Categoria: Adjudicado              |
+------------------------------------+
```

Si no hay proyectos vinculados, mostrar "Sin proyectos vinculados".

---

## Feature 2: Buscar proyectos por cliente en la barra de busqueda

### Cambios en `src/pages/Proyectos.tsx`

En la logica de `matchSearch` (linea 163-166), extender para buscar tambien en los nombres de clientes vinculados via `proyecto_clientes`:

```typescript
const matchSearch =
  p.nombre.toLowerCase().includes(search.toLowerCase()) ||
  p.comuna.toLowerCase().includes(search.toLowerCase()) ||
  (p.proyecto_clientes || []).some(pc =>
    pc.clientes?.nombre?.toLowerCase().includes(search.toLowerCase())
  );
```

Actualizar el placeholder del input de busqueda para indicar que se puede buscar por cliente (ej: "Buscar por nombre, comuna o cliente...").

---

### Sin cambios en base de datos

Ambas features usan datos ya disponibles via la relacion `proyecto_clientes` que fue agregada en la migracion anterior.

