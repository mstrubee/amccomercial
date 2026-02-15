

## Fix: "invalid input syntax for type date: 'null'"

### Root Cause

The AI-powered alert parser (`parse-alertas` edge function) sometimes returns the string `"null"` instead of actual `null` for alerts without dates. Since `"null"` is a truthy string, it passes through all existing filters and gets sent to the database as a date value, causing the Postgres error.

### Changes

**File: `src/pages/CargaMasiva.tsx`**

1. **Sanitize AI-parsed alert dates** (around line 632): When processing alerts returned by the AI, normalize the `fecha` field so that the string `"null"`, empty strings, and `undefined` all become actual `null`:
   ```
   const fecha = (a.fecha && a.fecha !== "null") ? a.fecha : null;
   ```

2. **Guard `fecha_seguimiento` before insert** (lines 1047 and 1070): Add a safety check so that only valid date strings are sent to Supabase. If `a.fecha` is falsy or `"null"`, skip or default appropriately. This is a defense-in-depth measure since fix #1 should already catch it.

3. **Guard `fecha_estado_obra`** (line 972): Add a similar safety check to ensure `"null"` string is converted to actual `null`:
   ```
   fecha_estado_obra: (fechaEstado && fechaEstado !== "null") ? fechaEstado : null,
   ```

### Technical Details

- The `parseDateValue` function already returns `null` for unrecognized strings, so `fecha_estado_obra` is likely not the culprit -- but the guard is added defensively.
- The main fix targets the alert parsing flow where AI returns `"null"` as a string literal for dateless entries, which then survives the `.filter((a) => a.fecha)` check on line 1033.
- No database or edge function changes required.

