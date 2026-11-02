"use client";

import { addDays } from "@/components/kit";
import { useHasSynced } from "@/lib/v2/use-day";
import { useRangeSummary } from "@/lib/v2/use-history";

/** A category's last 7 finished days (HIS-02): rate, counts, best and weakest item. */
export function CategoryWeekCard({ categoryId, today }: { categoryId: string; today: string }) {
  const summary = useRangeSummary(addDays(today, -7), addDays(today, -1), today);
  const synced = useHasSynced();
  const c = summary.byCategory.find((x) => x.category?.id === categoryId);
  if (!synced || !c || !c.due) return null;
  return (
    <section aria-label="Last 7 days" className="card space-y-1.5 p-3.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold text-ink">Last 7 days</h2>
        <span className="text-[15px] font-semibold text-ink tabular-nums">{c.rate}%</span>
      </div>
      <span className="block h-1.5 overflow-hidden rounded-full bg-track">
        <span className={`block h-full rounded-full ${(c.rate ?? 0) >= 80 ? "bg-done" : (c.rate ?? 0) <= 50 ? "bg-progress" : "bg-primary"}`} style={{ width: `${c.rate ?? 0}%` }} />
      </span>
      <p className="text-[12px] text-ink-2">
        {c.done} done · {c.missed} missed{c.skipped ? ` · ${c.skipped} skipped` : ""}
        {c.best ? ` · best: ${c.best.item.title}` : ""}
        {c.worst && c.worst.item.id !== c.best?.item.id ? ` · needs work: ${c.worst.item.title}` : ""}
      </p>
    </section>
  );
}
