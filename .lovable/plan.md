

# Show Unique Projects in Client Detail (Avoid Duplicates)

## Problem
The "Proyectos Vinculados" section in the client detail dialog shows one entry per project row. Since projects use a parent-child grouping structure (línea madre), the same project name (e.g. "Casa Papudo (Serrano 445)") appears multiple times — once per empresa/child row — each with a different category. This creates visual duplication.

## Solution
Group linked projects by name, showing each unique project name only once. Instead of displaying a single empresa category, show the estado (status) of the project, which is more meaningful and avoids the confusion of showing different categories for what appears to be the same project.

### Changes in `src/components/clientes/ClienteDetailDialog.tsx`

1. **Deduplicate by project name**: After filtering `linkedProyectos`, group them by `nombre` and keep only unique entries (first occurrence per name).

2. **Update display**: Replace the `categorias_proyecto` label with the project's estado or remove the subtitle if not relevant, since the category was empresa-specific and caused confusion.

3. **Navigation**: When clicking a deduplicated project, navigate to highlight the first matching project row.

