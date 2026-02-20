

## Fix: Alert Responsible User Assignment Failure

### Root Cause

The `UPDATE` RLS policy on the `alertas` table has no explicit `WITH CHECK` clause, so PostgreSQL defaults it to the same expression as `USING`:

```
USING (
  auth.uid() = usuario_responsable_id
  OR auth.uid() = created_by
  OR has_role(auth.uid(), 'admin')
)
```

PostgreSQL evaluates `USING` against the **old** row (to check if you can see/access it) and `WITH CHECK` against the **new** row (to check if the result is allowed). When a responsible user reassigns the alert to someone else:

1. `USING` passes (old row has their ID as `usuario_responsable_id`) -- access granted
2. `WITH CHECK` fails (new row has a **different** `usuario_responsable_id`, they're not creator, not admin) -- update rejected

### Fix

Add an explicit `WITH CHECK (true)` to the UPDATE policy. The `USING` clause already ensures only authorized users can attempt the update; the resulting row doesn't need additional restrictions since any authenticated user should be a valid responsable.

### Database Migration

```sql
DROP POLICY IF EXISTS "Responsible user or admin can update alertas" ON public.alertas;

CREATE POLICY "Responsible user or admin can update alertas"
ON public.alertas FOR UPDATE TO authenticated
USING (
  (auth.uid() = usuario_responsable_id)
  OR (auth.uid() = created_by)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (true);
```

### What Changes

- Only the RLS policy is modified -- no application code changes needed
- Users who are the current responsible, the creator, or admin can still update alerts
- The update result (including reassignment to a different user) will no longer be blocked

### Risk

Low. The `USING` clause still controls who can perform updates. `WITH CHECK (true)` only means the updated row content is unrestricted, which is safe since insert is already `WITH CHECK (true)`.

