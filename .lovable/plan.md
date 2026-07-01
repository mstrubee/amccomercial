## Objetivo
Insertar una nueva tarjeta KPI llamada **"Proyectos Cotizados"** en la fila de KPIs del listado de proyectos, ubicada entre "Proyectos en Construcción" y "Obras / Ejecución".

## Alcance
- **Conteo:** La tarjeta contará los **grupos de proyecto** (líneas madre) donde **al menos una empresa vinculada** tenga un estatus comercial (Estatus x Empresa) que coincida con:
  - **Categoría Cotización** y sus sub-estados:
    - Presupuesto Solicitado
    - Cotizado Empresa
    - Enviado a Cliente
  - **Categoría Negociación** y su sub-estado:
    - Cierre este mes
- El conteo se realiza sobre el universo completo de proyectos, no sobre el resultado filtrado.
- **Filtro rápido:** Al hacer click en la tarjeta se aplicará el filtro **"Estatus (x Empresa)"** (`filterCategorias`) con los IDs correspondientes y se limpiarán los demás filtros, de forma coherente con el comportamiento de las tarjetas existentes.

## Detalles técnicos
1. **Constantes:** Se agregará `COTIZACION_TARGET_IDS` con los UUIDs de categoría/subcategoría obtenidos de la base de datos:
   - Cotización (cat): `d24dd57b-ac65-460b-80a3-07ed24c97029`
   - Presupuesto Solicitado (sub): `ee31d10a-851c-4cab-93f8-ce42f2ac4f68`
   - Cotizado Empresa (sub): `a565de53-2d5d-45be-a1c1-01d77b8ea895`
   - Enviado a Cliente (sub): `d5e1df2f-eb42-42f9-b49c-47c9d6083948`
   - Negociación (cat): `35eaf6e0-a2f5-49ac-a33f-43850e095946`
   - Cierre este mes (sub): `19c00ab0-fa2d-42fb-b7c8-87bba0ccd8dd`

2. **Cálculo KPI (`kpiStats`):**
   - Nuevo campo `proyectosCotizados` en el objeto de estadísticas.
   - Se evalúa cada grupo verificando si alguna empresa vinculada tiene `categoria_id` o `subcategoria_id` (efectivo, vía `statusByPe`) dentro de `COTIZACION_TARGET_IDS`.

3. **Layout:** El contenedor de KPIs cambiará de `sm:grid-cols-5` a `sm:grid-cols-6` para evitar que la sexta tarjeta salte de línea.

4. **Componente `KpiCard`:** Se insertará entre la tarjeta "Proyectos en Construcción" y "Obras / Ejecución", con:
   - Título: "Proyectos Cotizados"
   - Icono: `FileText` (o similar de lucide-react)
   - `active`: verdadero cuando `filterCategorias` contenga exactamente los IDs del target.
   - `onClick`: alterna el filtro `filterCategorias` con los target IDs y limpia `filterEstados`, `filterEmpresas`, `filterEstadosObra`, `filterClasificaciones`, `filterBotones`, `search`.

5. **Sin cambios a:** lógica de agrupamiento, tablas, base de datos ni RLS.

## Archivos a modificar
- `src/pages/Proyectos.tsx`