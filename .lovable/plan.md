
## Fix: Dropdown selection clipping on left side

### Problem
When editing/selecting values in dropdown fields (like "Empresa"), the left edge of the selection highlight gets visually clipped. This happens because the scrollable form container has `pr-1` (right padding only) but no left padding, and `overflow-y-auto` causes horizontal clipping.

### Solution
Add symmetric horizontal padding (`px-2`) to the scrollable form area so that dropdown selections and focus states have enough breathing room on both sides.

### Technical Details

**File:** `src/components/alertas/AlertaFormDialog.tsx` (line 161)

Change the scrollable container's classes from:
```
space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1
```
to:
```
space-y-4 py-2 overflow-y-auto flex-1 min-h-0 px-2
```

This adds `2px` of padding on both left and right sides, preventing the dropdown highlight from being clipped against the container edge.
