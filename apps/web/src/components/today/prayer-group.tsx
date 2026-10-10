"use client";

import { toggleDone, type DayEntry } from "@life/shared";
import { PrayerRow, type PrayerChip } from "@/components/kit";
import { useActions } from "@/lib/v2/use-day";

/** Child occurrence → chip status. Qada is a done occurrence flagged in `detail`. */
function chipStatus(child: DayEntry): PrayerChip["status"] {
  const o = child.occurrence;
  if (o?.status === "done") return o.detail?.qada === true ? "qada" : "done";
  if (o?.status === "missed") return "missed";
  return "open";
}

/**
 * A group item (e.g. Daily prayers) as the kit's prayer row: one tap per child,
 * any order (PRY-03/04). Missed/Qada menu, times and insights arrive in Phase 4.
 */
export function PrayerGroup({ entry, date }: { entry: DayEntry; date: string }) {
  const run = useActions();
  const children = entry.children ?? [];
  return (
    <PrayerRow
      title={entry.item.title}
      prayers={children.map((c) => ({ key: c.key, label: c.item.title, status: chipStatus(c) }))}
      onToggle={(key) => {
        const child = children.find((c) => c.key === key);
        if (child) void run((ctx) => toggleDone(child, date, ctx));
      }}
    />
  );
}
