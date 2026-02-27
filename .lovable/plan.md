

## Actividad de Usuarios con Umbrales Personalizables

### Resumen
Agregar una columna "Actividad" a la tabla de usuarios que muestra el estado en tiempo real (Verde/Amarillo/Rojo) con umbrales de tiempo personalizables por usuario por el admin.

### Lógica de estados

| Estado | Color | Condición |
|--------|-------|-----------|
| Activo | Verde (pulsante) | Última interacción dentro de N minutos |
| Inactivo | Amarillo | Sin actividad entre N y Y minutos |
| Desconectado | Rojo | Sin actividad por más de Y minutos |

Donde **N** (umbral idle) e **Y** (umbral offline) son configurables por usuario.

### Cambios planificados

**1. Nueva tabla `user_activity_thresholds`**

Almacena los umbrales personalizados por usuario:
- `user_id` (uuid, unique, referencia a profiles.user_id)
- `idle_minutes` (integer, default 5) -- N minutos para pasar a amarillo
- `offline_minutes` (integer, default 15) -- Y minutos para pasar a rojo

RLS: admins pueden CRUD, usuarios autenticados pueden leer todos.

```sql
CREATE TABLE public.user_activity_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  idle_minutes integer NOT NULL DEFAULT 5,
  offline_minutes integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activity_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage thresholds"
  ON public.user_activity_thresholds FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read thresholds"
  ON public.user_activity_thresholds FOR SELECT
  TO authenticated
  USING (true);
```

**2. Modificar `src/pages/Usuarios.tsx`**

- Agregar columna "Actividad" entre "Creado" y "Acciones"
- Consultar `profiles` (para `last_seen_at`, `activity_status`, `current_section`) y `user_activity_thresholds` con realtime
- Cada fila muestra un indicador circular de color + texto de estado
- Suscribirse a cambios realtime en `profiles` para actualización instantánea
- Agregar un botón de configuracion (icono reloj/settings) en cada fila que abre un diálogo para editar los umbrales N e Y del usuario

**3. Nuevo componente `ActivityThresholdsDialog`**

Diálogo flotante para que el admin configure los umbrales por usuario:
- Input numérico para "Minutos para estado Inactivo (N)" (default 5)
- Input numérico para "Minutos para estado Desconectado (Y)" (default 15)
- Validación: Y debe ser mayor que N
- Botón guardar que hace upsert en `user_activity_thresholds`
- Botón "Restaurar valores predeterminados"

**4. Hook `useActivityThresholds`**

- Query para leer todos los umbrales (`user_activity_thresholds`)
- Mutation para upsert umbrales de un usuario
- Función helper `getActivityStatus(profile, thresholds)` que devuelve color/texto/pulse basado en los umbrales del usuario

**5. Actualizar `FloatingUserStatus.tsx`**

- Reutilizar la misma lógica de umbrales personalizados (leer `user_activity_thresholds`) para que el panel flotante también refleje los colores correctos por usuario

### Archivos a crear/modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Crear tabla `user_activity_thresholds` con RLS |
| `src/hooks/useActivityThresholds.ts` | Nuevo hook para query/mutation de umbrales + función `getActivityStatus` |
| `src/pages/Usuarios.tsx` | Agregar columna Actividad con indicador de color, botón config umbrales, realtime en profiles |
| `src/components/usuarios/ActivityThresholdsDialog.tsx` | Nuevo diálogo para configurar N e Y por usuario |
| `src/components/presence/FloatingUserStatus.tsx` | Usar umbrales personalizados en lugar de los 5 min hardcodeados |

