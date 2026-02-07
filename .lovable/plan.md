
## Reorganizar formulario de proyecto con secciones colapsables y notas integradas

### Objetivo
Reestructurar el formulario de edicion/creacion de proyectos para que los datos que cambian poco (ubicacion, contactos) esten agrupados y colapsados por defecto, dejando visibles los campos comerciales y de estado que se usan con mas frecuencia. Ademas, integrar el campo de notas directamente en el formulario.

### Estructura del formulario reorganizado

1. **Siempre visible (sin colapsar):**
   - Nombre del Proyecto
   - Estado Obra / Fecha Estado / Estado AMC
   - Empresa + Categoria + Cotizacion
   - Notas (textarea, 500 chars max, con contador)

2. **Seccion colapsable "Ubicacion"** (colapsada por defecto):
   - Direccion
   - Region
   - Comuna

3. **Seccion colapsable "Contactos"** (colapsada por defecto):
   - Arquitectura (nombre, contacto, email, telefono)
   - Constructora
   - ITO
   - Duenos

### Detalles tecnicos

**Componente utilizado:** Se usara `Collapsible` de Radix UI (`@radix-ui/react-collapsible`) que ya esta instalado en el proyecto.

**Cambios en `ProyectoFormDialog.tsx`:**
- Importar `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` desde `@/components/ui/collapsible`
- Importar icono `ChevronDown` de lucide-react para indicar estado abierto/cerrado
- Agregar estado `notas` al formulario con su setter, incluirlo en el snapshot de dirty-tracking
- Envolver los campos de ubicacion (Direccion, Region, Comuna) en un `Collapsible` con `defaultOpen={false}`
- Envolver los 4 bloques de contactos en otro `Collapsible` con `defaultOpen={false}`
- Agregar un `textarea` para notas (max 500 chars) en la zona visible, con contador de caracteres
- Incluir `notas` en el `ProyectoInput` enviado a `onSubmit`
- Al inicializar desde `initialData`, cargar el valor de notas

**Cambios en `useProyectos.ts`:**
- Agregar `notas` al tipo `ProyectoInput`
- Incluir `notas` en las operaciones de create y update

**Sincronizacion con el listado:**
- Las notas editadas en el formulario se guardan al hacer submit, y el listado se actualiza via invalidacion de la query `proyectos`
- Las notas editadas inline en el listado tambien se reflejan al abrir el formulario de edicion, ya que `initialData` proviene de la misma query

### Aspecto visual de las secciones colapsables
- Cada seccion tendra un encabezado clickeable con el titulo y un icono chevron que rota al expandir
- Estilo sutil con borde y fondo ligero para diferenciar las secciones colapsables del resto del formulario
