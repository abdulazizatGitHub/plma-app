"use client";

import { dayProgress, todayLocalDate } from "@life/shared";
import { BookOpen, Dumbbell, GraduationCap, Heart, Moon, Sparkles, Tag, Video, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { CategoryCard } from "@/components/kit";
import { EntryRow } from "@/components/today/entry-row";
import { PrayerGroup } from "@/components/today/prayer-group";
import { RowActionsMenu, type RowMenuTarget } from "@/components/today/row-actions-menu";
import { CATEGORY_TONES, type CategoryTone } from "@/lib/theme/tokens";
import { useCategories, useDay } from "@/lib/v2/use-day";

const ICONS: Record<string, LucideIcon> = {
  moon: Moon,
  dumbbell: Dumbbell,
  sparkles: Sparkles,
  book: BookOpen,
  graduation: GraduationCap,
  heart: Heart,
  video: Video,
};
const tone = (color: string): CategoryTone => ((CATEGORY_TONES as readonly string[]).includes(color) ? (color as CategoryTone) : "sky");

/** Sections with today's counts, expandable inline (CAT-03). Editing arrives in v2 Phase 3. */
export default function CategoriesPage() {
  const categories = useCategories();
  const [today, setToday] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<RowMenuTarget>(null);
  useEffect(() => setToday(todayLocalDate()), []); // eslint-disable-line react-hooks/set-state-in-effect -- client-only date
  const { entries } = useDay(today ?? "1970-01-01");

  const sections = [
    ...categories.map((c) => ({ id: c.id, name: c.name, icon: ICONS[c.icon] ?? Tag, tone: tone(c.color), category: c })),
    { id: null, name: "No category", icon: Tag, tone: "sky" as CategoryTone, category: undefined },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Categories</h1>
        <p className="text-[13px] text-ink-2">Creating and editing categories arrives in the next update.</p>
      </header>
      <div className="space-y-2">
        {sections.map((s) => {
          const mine = entries.filter((e) => (e.item.categoryId ?? null) === s.id);
          if (s.id === null && mine.length === 0) return null;
          const p = dayProgress(mine);
          const Icon = s.icon;
          return (
            <CategoryCard
              key={s.id ?? "none"}
              name={s.name}
              tone={s.tone}
              icon={<Icon className="h-5 w-5" />}
              done={p.done}
              total={p.required}
              expanded={open === (s.id ?? "none")}
              onToggle={() => setOpen(open === (s.id ?? "none") ? null : (s.id ?? "none"))}
            >
              {today
                ? mine.map((e) =>
                    e.children ? (
                      <PrayerGroup key={e.key} entry={e} date={today} />
                    ) : (
                      <EntryRow key={e.key} entry={e} date={today} category={s.category} onMore={(entry, anchor) => setMenuFor({ entry, anchor })} />
                    ),
                  )
                : null}
            </CategoryCard>
          );
        })}
        {categories.length === 0 ? (
          <p className="card px-4 py-6 text-center text-[15px] text-ink-2">No categories yet.</p>
        ) : null}
      </div>
      {today ? <RowActionsMenu key={menuFor?.entry.key ?? "none"} target={menuFor} date={today} today={today} onClose={() => setMenuFor(null)} /> : null}
    </div>
  );
}
