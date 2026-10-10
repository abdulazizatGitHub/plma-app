"use client";

import { ChevronDown } from "lucide-react";
import { useId, type ReactNode } from "react";
import type { CategoryTone } from "@/lib/theme/tokens";
import { Ring } from "./ring";

type CategoryCardProps = {
  name: string;
  icon: ReactNode;
  tone: CategoryTone;
  done: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  /** Item rows shown when expanded. */
  children?: ReactNode;
};

/** Category card (refs 2 & 4): pastel icon tile, "3 of 5 today", ring; expands inline. */
export function CategoryCard({ name, icon, tone, done, total, expanded, onToggle, children }: CategoryCardProps) {
  const panelId = useId();
  const pct = total ? (done / total) * 100 : 0;
  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-ink"
          style={{ background: `var(--cat-${tone})` }}
          aria-hidden
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink">{name}</span>
          <span className="block text-[12px] text-ink-2">
            {total ? `${done} of ${total} today` : "Nothing today"}
          </span>
        </span>
        {total ? (
          <Ring label={`${name}: ${done} of ${total} done today`} value={pct} size={40} stroke={5} />
        ) : null}
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-ink-2 transition-transform duration-(--duration-base) ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div id={panelId} className="space-y-2 bg-bg/60 p-3 pt-0">
          {children}
        </div>
      ) : null}
    </section>
  );
}
