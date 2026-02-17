

# Sistema de Reporteria de Actividad de Usuarios

## Objetivo
Crear un sistema que registre automaticamente las acciones realizadas por cada usuario (crear, editar, eliminar registros) y permita al admin consultar el historial de actividad por usuario y por dia. El admin podra configurar cuantos dias se conserva el historial.

## Componentes del Sistema

### 1. Nueva tabla `activity_log`
Almacenara cada accion realizada por los usuarios:
- `id` (uuid, PK)
- `user_id` (uuid, referencia al usuario)
- `action` (text: "crear", "editar", "eliminar", "completar")
- `entity_type` (text: "proyecto", "empresa", "alerta", "condicion", etc.)
- `entity_id` (uuid, ID del registro afectado)
- `entity_name` (text, nombre/titulo del registro para referencia rapida)
- `details` (text, detalles adicionales opcionales)
- `created_at` (timestamptz)

Politicas RLS:
- Solo admins pueden leer los registros
- Todos los usuarios autenticados pueden insertar (para que se registren sus propias acciones)

### 2. Tabla `app_settings` para configuracion
Almacenara la configuracion del tiempo de retencion:
- `id` (uuid, PK)
- `key` (text, unique) - ej: "activity_log_retention_days"
- `value` (text) - ej: "90"
- `updated_at` (timestamptz)

Politicas RLS: solo admins pueden leer y escribir.

### 3. Hook `useActivityLog`
Un hook reutilizable que expone una funcion `logActivity(action, entityType, entityId, entityName, details?)`. Se integrara en los hooks existentes (`useProyectos`, `useEmpresas`, `useAlertas`, etc.) para registrar automaticamente las acciones de crear, editar y eliminar.

### 4. Nueva pagina `Reporteria` (solo admin)
Accesible desde el menu de Administracion, mostrara:
- Selector de fecha (dia o rango)
- Selector de usuario (filtro)
- Tabla con las acciones registradas: hora, usuario, accion, tipo de entidad, nombre del registro
- Configuracion del tiempo de retencion del historial (en dias)

### 5. Edge Function `cleanup-activity-log`
Funcion programable que eliminara registros mas antiguos que el periodo de retencion configurado. Se podra invocar manualmente desde la UI del admin o se ejecutara al cargar la pagina de reporteria.

### 6. Integracion en el menu lateral
Agregar "Reporteria" como sub-item dentro del dropdown de Administracion.

---

## Detalles Tecnicos

### Migracion SQL
```sql
-- Tabla de log de actividad
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_name text DEFAULT '',
  details text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden leer
CREATE POLICY "Admins can read activity_log"
  ON public.activity_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Usuarios autenticados pueden insertar sus propias acciones
CREATE POLICY "Users can insert own activity"
  ON public.activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Solo admins pueden eliminar (para limpieza)
CREATE POLICY "Admins can delete activity_log"
  ON public.activity_log FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Tabla de configuracion
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage app_settings"
  ON public.app_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Valor por defecto de retencion
INSERT INTO public.app_settings (key, value) VALUES ('activity_log_retention_days', '90');
```

### Hooks a modificar
Se agregaran llamadas a `logActivity()` en las mutaciones `onSuccess` de:
- `useProyectos` (crear, editar proyecto)
- `useEmpresas` (crear, editar empresa)
- `useAlertas` (crear, editar, completar, eliminar alerta)

### Archivos nuevos
- `src/hooks/useActivityLog.ts` - Hook para registrar y consultar actividad
- `src/pages/Reporteria.tsx` - Pagina de reporteria para admin

### Archivos a modificar
- `src/App.tsx` - Agregar ruta `/reporteria`
- `src/components/layout/AppLayout.tsx` - Agregar "Reporteria" al menu admin
- `src/hooks/useProyectos.ts` - Integrar logging
- `src/hooks/useEmpresas.ts` - Integrar logging
- `src/hooks/useAlertas.ts` - Integrar logging

