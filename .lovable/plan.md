

# Collapsible Sections in Client Detail Dialog

## What
Make the four sections (Nombre, Categoría, Contactos, Proyectos Vinculados) in `ClienteDetailDialog` collapsible using the existing `Collapsible` component. All sections start collapsed by default.

## How

**File: `src/components/clientes/ClienteDetailDialog.tsx`**

1. Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `@/components/ui/collapsible` and `ChevronRight` from lucide
2. Wrap each section (Nombre, Categoría, Contactos, Proyectos Vinculados) in a `Collapsible` with `defaultOpen={false}`
3. Replace each `<Label>` with a `<CollapsibleTrigger>` styled as a clickable header with a rotating chevron icon
4. Wrap section content in `<CollapsibleContent>`
5. When in editing mode, auto-expand all sections (set `open={true}`) so the user can see all fields

