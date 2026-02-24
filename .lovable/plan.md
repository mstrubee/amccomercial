

## Delegacion temporal de alertas

### Resumen

El admin podra otorgar a cualquier usuario permiso temporal para **completar** y **crear alertas dependientes** de las alertas asignadas a otro usuario (el admin u otro). Este permiso tiene fecha de expiracion y puede ser revocado en cualquier momento. Las acciones realizadas bajo delegacion quedan diferenciadas en reportes como "completado a nombre de [nombre]".

### Alcance del permiso delegado

El usuario delegado podra:
- Completar alertas asignadas al usuario delegante
- Crear alertas dependientes (hijas) de esas alertas

NO podra:
- Crear alertas nuevas independientes a nombre del delegante
- Eliminar alertas del delegante
- Editar alertas del delegante

---

### 1. Nueva tabla: `delegaciones_alerta`

```sql
CREATE TABLE public.delegaciones_alerta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegante_id uuid NOT NULL,       -- usuario cuyas alertas se delegan
  delegado_id uuid NOT NULL,        -- usuario que recibe el permiso
  otorgado_por uuid NOT NULL,       -- admin que creo la delegacion
  fecha_inicio timestamptz NOT NULL DEFAULT now(),
  fecha_fin timestamptz NOT NULL,   -- expiracion del permiso
  revocada boolean NOT NULL DEFAULT false,
  revocada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(delegante_id, delegado_id)  -- solo una delegacion activa por par
);

ALTER TABLE public.delegaciones_alerta ENABLE ROW LEVEL SECURITY;

-- Admins pueden gestionar
CREATE POLICY "Admins can manage delegaciones"
  ON public.delegaciones_alerta FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Usuarios pueden leer sus propias delegaciones (como delegado)
CREATE POLICY "Users can read own delegaciones"
  ON public.delegaciones_alerta FOR SELECT
  USING (auth.uid() = delegado_id OR auth.uid() = delegante_id);
```

### 2. Hook: `useDelegaciones.ts`

Nuevo hook con:
- `useDelegacionesActivas()`: retorna delegaciones activas del usuario actual (donde es delegado, no revocadas, dentro del rango de fechas)
- `useDelegacionesPorUsuario(userId)`: para admin, retorna delegaciones de un usuario
- `useCreateDelegacion()`: mutation para crear delegacion
- `useRevokeDelegacion()`: mutation para revocar

### 3. Modificar la logica de completar alertas

**`src/hooks/useAlertas.ts` - `useToggleAlertaCompletada`**:
- Agregar campo opcional `on_behalf_of` al input
- Cuando el usuario completa una alerta que no es suya (es delegado), guardar `completed_by = usuario_actual` pero tambien registrar en `activity_log` con detalle "a nombre de [delegante]"
- La RLS de alertas ya permite UPDATE con `WITH CHECK (true)`, lo cual es compatible

**`src/pages/Alertas.tsx`**:
- Antes de permitir completar una alerta, verificar si el usuario actual es el responsable, admin, o tiene delegacion activa
- Si actua como delegado, pasar esa informacion al proceso de completar

### 4. Modificar la logica de crear alertas dependientes

**`src/hooks/useAlertas.ts` - `useCreateAlerta`**:
- Cuando se crea una alerta dependiente bajo delegacion, el `created_by` sera el usuario actual pero se registrara en `activity_log` con detalle "a nombre de [delegante]"

### 5. UI de gestion de delegaciones (en Usuarios)

**`src/pages/Usuarios.tsx`**:
- Nuevo boton en las acciones de cada usuario: icono de "UserCheck" para gestionar delegaciones
- Nuevo dialog `DelegacionesDialog` con:
  - Lista de delegaciones activas del usuario seleccionado (como delegante)
  - Formulario para crear nueva delegacion: seleccionar delegado + fecha fin
  - Boton para revocar delegaciones existentes

### 6. Indicador visual en Alertas

**`src/pages/Alertas.tsx`**:
- Cuando el usuario tiene delegaciones activas, mostrar un banner sutil indicando "Actuando en nombre de [nombre] hasta [fecha]"
- En la tabla, las alertas que puede completar por delegacion tendran un indicador visual (tooltip o badge)

### 7. Diferenciacion en reportes

**`src/pages/Reporteria.tsx`**:
- En la columna de detalles del activity_log, cuando el detalle contenga "a nombre de", mostrar con badge diferenciado
- Agregar label "delegado" en `actionLabels`

**`src/hooks/useActivityLog.ts`**:
- Sin cambios estructurales; el campo `details` ya existe y se usara para guardar "a nombre de [nombre]"

---

### Secuencia tecnica

1. Crear tabla `delegaciones_alerta` con migracion
2. Crear hook `useDelegaciones.ts`
3. Crear componente `DelegacionesDialog.tsx` en `src/components/usuarios/`
4. Integrar dialog en `src/pages/Usuarios.tsx`
5. Modificar `useToggleAlertaCompletada` y `useCreateAlerta` para soportar delegacion
6. Modificar `Alertas.tsx` para verificar delegaciones y mostrar indicadores
7. Ajustar `Reporteria.tsx` para diferenciar acciones delegadas

### Archivos nuevos
- `src/hooks/useDelegaciones.ts`
- `src/components/usuarios/DelegacionesDialog.tsx`

### Archivos a modificar
- `src/hooks/useAlertas.ts` - agregar soporte de delegacion en completar y crear dependientes
- `src/pages/Usuarios.tsx` - boton y dialog de delegaciones
- `src/pages/Alertas.tsx` - verificacion de delegaciones, indicadores visuales
- `src/pages/Reporteria.tsx` - diferenciacion visual de acciones delegadas
- Migracion SQL para nueva tabla

