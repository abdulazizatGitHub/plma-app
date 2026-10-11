"use client";

import { moveTo, todayLocalDate, toggleDone, type DayEntry, type Item } from "@life/shared";
import { useEffect, useState } from "react";
import { TaskRow } from "@/components/kit";
import { RowActionsMenu, type RowMenuTarget } from "@/components/today/row-actions-menu";
import { useActions, useAllItems, useCategories, usePending } from "@/lib/v2/use-day";

const asEntry = (item: Item): DayEntry => ({ key: `${item.id}|`, item, slot: "", occurrence: null });

/** Tasks without a day (SCH-05, FLX-03): give them a day, or finish them now. */
export default function PendingPage() {
  const pending = usePending();
  const categories = useCategories();
  const { items } = useAllItems();
  const run = useActions();
  const [today, setToday] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<RowMenuTarget>(null);
  useEffect(() => setToday(todayLocalDate()), []); // eslint-disable-line react-hooks/set-state-in-effect -- client-only date

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Pending</h1>
        <p className="text-[13px] text-ink-2">Tasks without a day. They never count against your progress.</p>
      </header>
      {pending.length === 0 ? (
        <p className="card px-4 py-6 text-center text-[15px] text-ink-2">Nothing pending.</p>
      ) : (
        <div className="space-y-2">
          {pending.map((item) => {
            const category = categories.find((c) => c.id === item.categoryId);
            // Undated plan steps (e.g. "Payment cleared") say which plan they belong to.
            const plan = item.parentId ? items.find((i) => i.id === item.parentId && i.type === "plan") : undefined;
            return (
              <TaskRow
                key={item.id}
                title={item.title}
                meta={[plan?.title, category?.name].filter(Boolean).join(" · ") || undefined}
                categoryColor={category ? `var(--cat-${category.color})` : undefined}
                priority={item.priority}
                state="todo"
                // Finishing a pending task records it as done today.
                onToggle={() =>
                  today &&
                  void run(async (ctx) => {
                    const [scheduled] = await moveTo(asEntry(item), today, today, ctx);
                    const done = await toggleDone(asEntry(scheduled.row as Item), today, ctx);
                    return [scheduled, ...done];
                  })
                }
                onMore={(anchor) => setMenuFor({ entry: asEntry(item), anchor })}
              />
            );
          })}
        </div>
      )}
      {today ? <RowActionsMenu key={menuFor?.entry.key ?? "none"} target={menuFor} date={null} today={today} onClose={() => setMenuFor(null)} /> : null}
    </div>
  );
}
