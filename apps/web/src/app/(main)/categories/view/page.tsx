"use client";

import {
  archiveCategory,
  archiveItem,
  buildDay,
  dayProgress,
  isPinned,
  moveItem,
  pinItem,
  sortItems,
  todayLocalDate,
  unarchiveCategory,
  unarchiveItem,
  type Item,
} from "@life/shared";
import { Archive, ArrowDown, ArrowLeft, ArrowUp, Pencil, Pin, PinOff, Plus, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, createElement, useEffect, useMemo, useState } from "react";
import { CategorySheet } from "@/components/categories/category-sheet";
import { ItemListRow } from "@/components/categories/item-list-row";
import { Button, PopoverMenu, PopoverMenuDivider, PopoverMenuItem, Ring } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { categoryIcon, categoryTone } from "@/lib/v2/category-style";
import { toneInkClass } from "@/lib/theme/tokens";
import { useActions, useAllItems, useCategory } from "@/lib/v2/use-day";

const GROUPS: { title: string; match: (i: Item) => boolean }[] = [
  { title: "Routines", match: (i) => i.type === "group" },
  { title: "Habits", match: (i) => i.type !== "group" && i.schedule.kind !== "once" },
  { title: "Tasks", match: (i) => i.type !== "group" && i.schedule.kind === "once" },
];

/** One category: its items by kind, reorder / pin / archive, add (CAT-02, ITM-05). */
function CategoryView() {
  const id = useSearchParams().get("id");
  const category = useCategory(id);
  const { items, ready } = useAllItems();
  const run = useActions();
  const router = useRouter();
  const { notify } = useAddSheet();
  const [today, setToday] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [menu, setMenu] = useState<{ item: Item; siblings: Item[]; anchor: HTMLElement } | null>(null);
  useEffect(() => setToday(todayLocalDate()), []); // eslint-disable-line react-hooks/set-state-in-effect -- client-only date

  const mine = useMemo(() => items.filter((i) => i.categoryId === id && !i.parentId), [items, id]);
  const live = sortItems(mine.filter((i) => !i.archivedAt));
  const archived = mine.filter((i) => i.archivedAt && i.archivedAt !== category?.archivedAt);
  const progress = useMemo(() => (today ? dayProgress(buildDay(items.filter((i) => i.categoryId === id), [], today)) : null), [items, id, today]);
  const subCount = (i: Item) => items.filter((c) => c.parentId === i.id && !c.deletedAt).length;

  if (!ready) return <div className="skeleton h-40" aria-busy="true" aria-label="Loading category" />;
  if (!category) {
    return (
      <div className="card px-5 py-6 text-center">
        <p className="text-[14px] font-medium text-ink">This category doesn&apos;t exist anymore.</p>
        <Link href="/categories" className="mt-2 inline-block text-[13px] font-medium text-link">
          Back to Categories
        </Link>
      </div>
    );
  }
  const tone = categoryTone(category);

  return (
    <div className="space-y-4">
      <Link href="/categories" className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Categories
      </Link>
      <header className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneInkClass(tone)}`} style={{ background: `var(--cat-${tone})` }} aria-hidden>
          {createElement(categoryIcon(category), { className: "h-5 w-5" })}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-ink">{category.name}</h1>
          <p className="text-[12px] text-ink-2">
            {category.archivedAt ? "Archived" : `${live.length} item${live.length === 1 ? "" : "s"}`}
            {progress && progress.required && !category.archivedAt ? ` · ${progress.done} of ${progress.required} today` : ""}
          </p>
        </div>
        {progress && progress.required && !category.archivedAt ? (
          <Ring label={`${category.name}: ${progress.pct}% today`} value={progress.pct} size={40} stroke={5} />
        ) : null}
      </header>

      <div className="flex flex-wrap gap-1.5">
        {category.archivedAt ? (
          <Button size="sm" onClick={() => void run((ctx) => unarchiveCategory(category, items, ctx))}>
            <Undo2 className="h-3.5 w-3.5" aria-hidden /> Restore category
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={() => router.push(`/items/edit?category=${category.id}`)}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add item
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void run((ctx) => archiveCategory(category, items, ctx));
                notify({ message: `Archived “${category.name}”` });
                router.push("/categories");
              }}
            >
              <Archive className="h-3.5 w-3.5" aria-hidden /> Archive
            </Button>
          </>
        )}
      </div>

      {GROUPS.map(({ title, match }) => {
        const list = (category.archivedAt ? sortItems(mine) : live).filter(match);
        if (!list.length) return null;
        return (
          <section key={title} aria-label={title} className="space-y-1.5">
            <h2 className="flex items-baseline gap-1.5 text-[15px] font-semibold text-ink">
              {title} <span className="text-[12px] font-normal text-ink-2">{list.length}</span>
            </h2>
            {list.map((i) => (
              <ItemListRow
                key={i.id}
                item={i}
                subCount={i.type === "group" ? subCount(i) : undefined}
                onMore={category.archivedAt ? undefined : (anchor) => setMenu({ item: i, siblings: list, anchor })}
              />
            ))}
          </section>
        );
      })}
      {live.length === 0 && !category.archivedAt ? (
        <div className="card flex flex-col items-center gap-2 px-5 py-6 text-center">
          <p className="text-[14px] font-medium text-ink">Nothing in {category.name} yet.</p>
          <Button className="mt-1" onClick={() => router.push(`/items/edit?category=${category.id}`)}>
            <Plus className="h-4 w-4" aria-hidden /> Add item
          </Button>
        </div>
      ) : null}

      {archived.length ? (
        <section aria-label="Archived items">
          <button type="button" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)} className="min-h-9 text-[13px] font-medium text-ink-2 hover:text-ink">
            Archived items · {archived.length}
          </button>
          {showArchived ? (
            <ul className="mt-1 space-y-1.5">
              {archived.map((i) => (
                <li key={i.id} className="card flex items-center gap-3 px-3 py-2">
                  <Link href={`/items/view?id=${i.id}`} className="min-w-0 flex-1 truncate text-[14px] text-ink-2">
                    {i.title}
                  </Link>
                  <Button size="sm" variant="secondary" onClick={() => void run((ctx) => unarchiveItem(i, items, ctx))}>
                    <Undo2 className="h-3.5 w-3.5" aria-hidden /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {menu ? (
        <PopoverMenu anchor={menu.anchor} onClose={() => setMenu(null)} label={menu.item.title}>
          {(() => {
            const at = menu.siblings.findIndex((s) => s.id === menu.item.id);
            const close = (fn: () => void) => () => {
              fn();
              setMenu(null);
            };
            return (
              <>
                <PopoverMenuItem icon={<Pencil />} label="Edit" onClick={close(() => router.push(`/items/edit?id=${menu.item.id}`))} />
                {isPinned(menu.item) ? (
                  <PopoverMenuItem icon={<PinOff />} label="Unpin" onClick={close(() => void run((ctx) => pinItem(menu.item, false, ctx)))} />
                ) : (
                  <PopoverMenuItem icon={<Pin />} label="Pin to top" onClick={close(() => void run((ctx) => pinItem(menu.item, true, ctx)))} />
                )}
                {at > 0 ? <PopoverMenuItem icon={<ArrowUp />} label="Move up" onClick={close(() => void run((ctx) => moveItem(menu.siblings, menu.item.id, -1, ctx)))} /> : null}
                {at < menu.siblings.length - 1 ? (
                  <PopoverMenuItem icon={<ArrowDown />} label="Move down" onClick={close(() => void run((ctx) => moveItem(menu.siblings, menu.item.id, 1, ctx)))} />
                ) : null}
                <PopoverMenuDivider />
                <PopoverMenuItem
                  icon={<Archive />}
                  label="Archive"
                  onClick={close(() => {
                    void run((ctx) => archiveItem(menu.item, items, ctx));
                    notify({ message: `Archived “${menu.item.title}”` });
                  })}
                />
              </>
            );
          })()}
        </PopoverMenu>
      ) : null}

      <CategorySheet open={editing} category={category} onClose={() => setEditing(false)} />
    </div>
  );
}

export default function CategoryViewPage() {
  return (
    <Suspense fallback={<div className="skeleton h-40" aria-busy="true" aria-label="Loading category" />}>
      <CategoryView />
    </Suspense>
  );
}
