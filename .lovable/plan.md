

# Fix: Slow Search Input in Proyectos

## Problem
Typing in the search field is extremely slow because each keystroke triggers re-renders of the entire Proyectos page, including hundreds of table rows. Three root causes:

1. **No isolated search component**: The `searchInput` state lives in the parent, so every keystroke re-renders the entire page (1600+ lines of JSX)
2. **`filtered` array not memoized**: The filtering logic (line 211) runs on every render instead of only when dependencies change
3. **N+1 data fetching**: Each `EmpresasCell` and `GroupEmpresasCell` independently calls `useVentasByProyectoEmpresaIds`, creating dozens of parallel queries that all re-trigger on state changes

## Solution (based on LeaseFlow Pro pattern)

### Step 1 -- Create isolated `DebouncedInput` component
Extract a `memo`'d `DebouncedInput` that manages its own local state internally, only propagating the value to the parent after a 200ms delay. This completely isolates keystroke renders from the parent component.

### Step 2 -- Memoize `filtered` array
Wrap the filtering logic (line 211-236) in `useMemo` with proper dependencies (`proyectos`, `search`, `filterEstados`, etc.).

### Step 3 -- Lift ventas data to parent level
- Collect all `proyecto_empresa` IDs once at the parent level
- Make a single `useVentasByProyectoEmpresaIds` call
- Build a `ventasMap: Map<string, number>` and pass it as a prop to `EmpresasCell` / `GroupEmpresasCell`
- Remove the individual `useVentasByProyectoEmpresaIds` hooks from those cell components

### Step 4 -- Memoize cell components
Wrap `EmpresasCell` and `GroupEmpresasCell` in `React.memo` so they only re-render when their props actually change.

## Technical details

**File changed**: `src/pages/Proyectos.tsx`

- Add `DebouncedInput` component (identical pattern to LeaseFlow Pro) before the `Proyectos` default export
- Replace `<Input ... value={searchInput} onChange={...} />` with `<DebouncedInput value={search} onChange={setSearch} />`
- Remove `searchInput` state and the debounce `useEffect`
- Wrap `filtered` in `useMemo`
- Add a single `useVentasByProyectoEmpresaIds(allPeIds)` call at top level
- Pass pre-computed `ventasMap` to cell components as a prop
- Wrap cell components with `memo()`

