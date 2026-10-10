"use client";

import { isPinned, type Item } from "@life/shared";
import { CalendarDays, ChevronRight, ListChecks, MoreHorizontal, Pin, Repeat2 } from "lucide-react";
import Link from "next/link";
import { Tag } from "@/components/kit";
import { scheduleSummary, trackingSummary } from "@/lib/v2/item-text";

const KIND_ICON = { task: CalendarDays, habit: Repeat2, group: ListChecks, goal: Repeat2, plan: CalendarDays } as const;

/** An item in a list (category detail): opens its detail page; ⋯ for edit/move/pin/archive. */
export function ItemListRow({ item, subCount, onMore }: { item: Item; subCount?: number; onMore?: (anchor: HTMLElement) => void }) {
  const Icon = KIND_ICON[item.type];
  const tracking = trackingSummary(item);
  return (
    <div className="card flex items-center gap-1 pr-1.5">
      <Link href={`/items/view?id=${item.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-track text-ink-2" aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[14px] font-medium text-ink">
            <span className="truncate">{item.title}</span>
            {isPinned(item) ? <Pin className="h-3.5 w-3.5 shrink-0 text-ink-2" aria-label="Pinned" /> : null}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-1">
            <Tag>{scheduleSummary(item)}</Tag>
            {tracking ? <Tag>{tracking}</Tag> : null}
            {subCount ? <Tag>{subCount} sub-items</Tag> : null}
            {item.isOptional ? <Tag>Optional</Tag> : null}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
      </Link>
      {onMore ? (
        <button
          type="button"
          aria-label={`More actions for ${item.title}`}
          onClick={(e) => onMore(e.currentTarget)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-track hover:text-ink"
        >
          <MoreHorizontal className="h-4.5 w-4.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
