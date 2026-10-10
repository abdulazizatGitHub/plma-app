import { describeSchedule, type Item } from "@life/shared";
import { formatTime } from "./category-style";
import { shortDate } from "./dates";

const ORDINAL = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/** "Every day", "Mon · Wed · Fri", "Sat 10 Oct · 6:30 PM", "No date (Pending)"… plus the active range. */
export function scheduleSummary(item: Pick<Item, "schedule">): string {
  const s = item.schedule;
  if (s.kind === "once") {
    if (!s.date) return "No date (Pending)";
    return [shortDate(s.date), s.time ? formatTime(s.time) : null].filter(Boolean).join(" · ");
  }
  const base =
    s.kind === "daily"
      ? "Every day"
      : s.kind === "weekdays" && s.weekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => s.weekdays.includes(d))
        ? "Weekdays"
        : s.kind === "monthly"
          ? `Monthly on the ${ORDINAL(s.monthDay)}`
          : (describeSchedule(item) ?? "Repeats");
  const range =
    s.activeFrom && s.activeUntil
      ? `${shortDate(s.activeFrom)} – ${shortDate(s.activeUntil)}`
      : s.activeFrom
        ? `from ${shortDate(s.activeFrom)}`
        : s.activeUntil
          ? `until ${shortDate(s.activeUntil)}`
          : null;
  return [base, range].filter(Boolean).join(" · ");
}

/** "10,000 steps", "20 min", "5 steps", or null for plain check items. */
export function trackingSummary(item: Pick<Item, "tracking">): string | null {
  const t = item.tracking;
  if (t.kind === "quantity") return `${t.target ? `${t.target.toLocaleString("en-US")} ` : ""}${t.unit}`;
  if (t.kind === "duration") return t.targetMin ? `${t.targetMin} min` : "Timed";
  if (t.kind === "checklist") return `${t.steps.length} steps`;
  return null;
}

export const KIND_LABEL: Record<Item["type"], string> = {
  task: "Task",
  habit: "Habit",
  group: "Routine",
  goal: "Goal",
  plan: "Plan",
};
