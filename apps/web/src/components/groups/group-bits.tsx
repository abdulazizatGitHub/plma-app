import type { GoalView, GroupIcon, GroupStreak } from "@life/shared";
import { BookOpen, Dumbbell, Flame, GraduationCap, Heart, Hourglass, House, Moon, Star, Users } from "lucide-react";

export const GROUP_ICON: Record<GroupIcon, typeof Users> = { users: Users, home: House, moon: Moon, dumbbell: Dumbbell, book: BookOpen, graduation: GraduationCap, heart: Heart, star: Star };

/** A group's icon on its pastel. */
export function GroupTile({ icon, color, size = 44 }: { icon: GroupIcon; color: string; size?: number }) {
  const Icon = GROUP_ICON[icon] ?? Users;
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-[14px] text-ink" style={{ width: size, height: size, background: `var(--cat-${color})` }}>
      <Icon style={{ width: size * 0.48, height: size * 0.48 }} />
    </span>
  );
}

export function GroupStreakBadge({ streak }: { streak: GroupStreak }) {
  if (!streak.count) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-ink tabular-nums" aria-label={`${streak.count}-day group streak${streak.atRisk ? ", ends soon" : ""}`}>
      {streak.count}
      <Flame className="h-4 w-4 text-progress" fill="currentColor" aria-hidden />
      {streak.atRisk ? <Hourglass className="h-3.5 w-3.5 text-todo" aria-hidden /> : null}
    </span>
  );
}

const fmt = (n: number) => (Number.isInteger(n) ? n : Math.round(n * 10) / 10).toLocaleString("en-US");

/** "12,000 / 70,000 steps", "3 / 5 days", "90 / 150 min". */
export function goalAmount(g: Pick<GoalView, "tracking" | "unit">, value: number, target: number): string {
  const unit = g.tracking === "check" ? (target === 1 ? "day" : "days") : g.tracking === "duration" ? "min" : (g.unit ?? "");
  return `${fmt(value)} / ${fmt(target)} ${unit}`.trim();
}

export function Bar({ pct, done }: { pct: number; done?: boolean }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-track" aria-hidden>
      <span className={`block h-full rounded-full transition-[width] duration-(--duration-slow) ${done ? "bg-done" : "bg-primary"}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}
