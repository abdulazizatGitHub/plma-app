import { timeLeft, type FriendStreak } from "@life/shared";
import { Flame, Hourglass } from "lucide-react";

/** 🔥 N with a friend, and ⌛ when it ends soon (Snapchat-style, owner 2026-10-16). */
export function StreakBadge({ streak, now = new Date() }: { streak: FriendStreak; now?: Date }) {
  if (!streak.count) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-ink tabular-nums"
      aria-label={`${streak.count}-day snap streak${streak.atRisk && streak.endsAt ? `, ends in ${timeLeft(streak.endsAt, now).replace(" left", "")}` : ""}`}
    >
      {streak.count}
      <Flame className="h-4 w-4 text-progress" fill="currentColor" aria-hidden />
      {streak.atRisk ? <Hourglass className="h-3.5 w-3.5 text-todo" aria-hidden /> : null}
    </span>
  );
}
