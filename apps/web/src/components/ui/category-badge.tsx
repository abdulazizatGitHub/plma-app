import type { ReactNode } from "react";
import { CATEGORY_BG, habitCategory } from "@/lib/theme/habit-category";

type CategoryBadgeProps = {
  /** DashboardRow.key — looked up against the shared category map. */
  category: string;
  icon: ReactNode;
  size?: "sm" | "md";
  className?: string;
};

const SIZES = { sm: "h-8 w-8", md: "h-10 w-10" } as const;

/** Solid pastel chip with a dark icon — identical in every theme and mode. */
export function CategoryBadge({ category, icon, size = "md", className = "" }: CategoryBadgeProps) {
  return (
    <span
      className={`flex ${SIZES[size]} shrink-0 items-center justify-center rounded-(--radius-chip) text-cat-ink ${
        CATEGORY_BG[habitCategory(category)]
      } ${className}`}
      aria-hidden
    >
      {icon}
    </span>
  );
}
