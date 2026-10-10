import type { ReactNode } from "react";
import type { CategoryTone } from "@/lib/theme/tokens";

export type ChipTone = "todo" | "progress" | "done" | "muted" | "primary" | "neutral" | CategoryTone;

const TONE: Record<ChipTone, string> = {
  todo: "bg-todo text-on-fill",
  progress: "bg-progress text-on-fill",
  done: "bg-done text-on-fill",
  muted: "bg-muted text-on-fill",
  primary: "bg-primary text-on-fill",
  neutral: "bg-track text-ink",
  mint: "bg-cat-mint text-ink",
  lilac: "bg-cat-lilac text-ink",
  peach: "bg-cat-peach text-ink",
  lime: "bg-cat-lime text-ink",
  pink: "bg-cat-pink text-ink",
  sky: "bg-cat-sky text-on-fill",
};

/** Small rounded label. Color only where it carries meaning (status, category). */
export function Chip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${TONE[tone]}`}>
      {children}
    </span>
  );
}
