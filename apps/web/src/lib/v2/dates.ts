import { addDays } from "@/components/kit";

const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

const LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const SHORT = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "long" });

/** "Friday, 9 October" */
export const longDate = (iso: string) => LONG.format(toDate(iso)).replace(/^(\w+) /, "$1, ");
/** "Fri 9 Oct" */
export const shortDate = (iso: string) => SHORT.format(toDate(iso));

/** "Today" / "Tomorrow" / "Yesterday" / "Saturday" (within a week) / "Fri 16 Oct". */
export function dayLabel(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  if (iso === addDays(today, -1)) return "Yesterday";
  const diff = Math.round((toDate(iso).getTime() - toDate(today).getTime()) / 86_400_000);
  return Math.abs(diff) < 7 ? WEEKDAY.format(toDate(iso)) : shortDate(iso);
}

/** "Today", "Tomorrow · Sun 11 Oct", or just "Mon 12 Oct" — never the weekday twice. */
export function whenLabel(iso: string, today: string, sep = " · "): string {
  const near = dayLabel(iso, today);
  if (iso === today) return near;
  return near === "Tomorrow" || near === "Yesterday" ? `${near}${sep}${shortDate(iso)}` : shortDate(iso);
}
