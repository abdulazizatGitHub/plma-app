const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Formats a Date as a local calendar date string (YYYY-MM-DD), not UTC. */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocalDate(): string {
  return toLocalDateString(new Date());
}

export function isValidLocalDateString(value: string): boolean {
  if (!LOCAL_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  return (
    parsed.getFullYear() === y &&
    parsed.getMonth() === m - 1 &&
    parsed.getDate() === d
  );
}
