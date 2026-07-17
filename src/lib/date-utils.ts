import { format } from "date-fns";

/**
 * Formats a date value with date-fns, returning a fallback instead of throwing
 * when the value is null/empty or produces an Invalid Date.
 *
 * `date-fns` `format()` throws `RangeError: Invalid time value` for invalid
 * dates; a bad DB value (empty string, malformed legacy/bulk-imported date)
 * would crash the render and — with no Error Boundary — blank the whole app.
 */
export function safeFormatDate(
  value: string | number | Date | null | undefined,
  fmt: string,
  options?: Parameters<typeof format>[2],
  fallback = "—",
): string {
  if (value == null || value === "") return fallback;
  // A date-only string ("YYYY-MM-DD") is parsed by `new Date()` as UTC midnight,
  // which renders as the previous day in negative-UTC timezones (e.g. Chile).
  // Route those through parseLocalDate so the calendar day is preserved.
  const d =
    value instanceof Date
      ? value
      : typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? parseLocalDate(value)
        : new Date(value);
  if (isNaN(d.getTime())) return fallback;
  return format(d, fmt, options);
}

/**
 * Parse a date-only string (YYYY-MM-DD) as local date, avoiding UTC timezone shift.
 * This prevents the off-by-one-day issue in negative UTC offset timezones.
 */
export function parseLocalDate(dateStr: string): Date {
  // If it's already a full ISO string with time, just parse normally
  if (dateStr.includes("T")) return new Date(dateStr);
  // For date-only strings, append noon to avoid timezone boundary issues
  return new Date(dateStr + "T12:00:00");
}

/**
 * Returns today's date as YYYY-MM-DD using the user's local timezone.
 * Avoids the UTC off-by-one issue from `new Date().toISOString().split("T")[0]`.
 */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
