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
