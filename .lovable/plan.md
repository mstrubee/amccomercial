

# Bidirectional Sync: Project Contacts and Clients

## Current Architecture Problem

Contact data lives in **two disconnected places**:
1. **Proyectos table**: Denormalized text fields (`arq_nombre`, `arq_contacto`, `arq_mail`, `arq_telefono`, etc.) using " / " as delimiter for multiple entries
2. **Clientes table**: Normalized records with `contactos_cliente` sub-records

When a user selects a client via ClientePicker, the data is copied into the project text fields. After that, the two are disconnected — editing in one place does not update the other.

## Solution

### Approach: Link-based sync on save

Instead of real-time two-way binding (which would be fragile given the denormalized text fields), we implement sync at **save time** in both directions:

### 1. Project form save → Update linked clients

**File: `src/components/proyectos/ProyectoFormDialog.tsx`**

- Track which client was selected for each contact row (store `cliente_id` alongside the row data)
- On project save (`onSubmit`), for each contact row that has a linked `cliente_id`, call `useUpdateCliente` to update the client's `contactos_cliente` with the edited values (contacto, email, telefono)
- Only sync rows where the user actually modified the data (compare against the original client data)

### 2. Client edit → Update linked projects

**File: `src/hooks/useClientes.ts` (useUpdateCliente mutation)**

- After updating a client, query `proyecto_clientes` to find all linked projects
- For each linked project, check the contact text fields (arq_nombre, const_nombre, etc.) to find where this client's name appears
- Update the corresponding contacto/email/telefono fields in those projects with the new client data

### 3. Track client-row association in the form

**File: `src/components/proyectos/ProyectoFormDialog.tsx`**

- Extend `ContactoRow` to include an optional `clienteId` field
- When `applyCliente` is called, store the client ID alongside the row
- When manually editing a row that was populated from a client, preserve the `clienteId` so we know which client to update on save
- Pass the client associations up to the submit handler

### 4. New hook: `useSyncClienteProyecto`

**File: `src/hooks/useSyncClienteProyecto.ts` (new)**

- Centralized utility with two functions:
  - `syncProjectToClientes(proyectoId, contactSections)`: Updates clients whose data was modified in the project form
  - `syncClienteToProyectos(clienteId, newData)`: Updates all projects linked to this client with the new contact info

## Technical Details

- The `CONTACTO_CAT_MAP` already maps section titles (Arquitectura, Constructora, ITO, Dueños) to client categories — this is used to determine which client category to search
- The " / " delimiter pattern in project fields means a single section can have multiple clients; each must be tracked independently
- The `proyecto_clientes` junction table already exists and links projects to clients, providing the relationship data needed for reverse sync
- Client sync will use the existing `useUpdateCliente` and `useProyectos` update mutations
- Toast notifications will inform the user when cross-updates occur (e.g., "Cliente 'X' actualizado desde proyecto")

## Files Changed
- `src/hooks/useSyncClienteProyecto.ts` — new hook with sync logic
- `src/components/proyectos/ProyectoFormDialog.tsx` — track clienteId per row, call sync on save
- `src/hooks/useClientes.ts` — add reverse sync in `useUpdateCliente`
- `src/components/clientes/ClienteDetailDialog.tsx` — call reverse sync on client save

