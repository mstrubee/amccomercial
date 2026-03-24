const monthNames: Record<string, string> = {
  "0": "ene", "1": "feb", "2": "mar", "3": "abr", "4": "may", "5": "jun",
  "6": "jul", "7": "ago", "8": "sep", "9": "oct", "10": "nov", "11": "dic",
};

export function formatChecklistDate(isoStr: string): string {
  const d = new Date(isoStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function formatCompletedDate(isoStr: string): string {
  const d = new Date(isoStr);
  const y = d.getFullYear();
  const mon = monthNames[String(d.getMonth())];
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${mon}.${day}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
