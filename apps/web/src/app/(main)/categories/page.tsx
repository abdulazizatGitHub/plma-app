"use client";

import {
  archiveCategory,
  dayProgress,
  deleteCategory,
  moveCategory,
  unarchiveCategory,
  type Category,
  type DayEntry,
} from "@life/shared";
import { ArrowDown, ArrowRight, ArrowUp, Archive, MoreHorizontal, Package, Pencil, Plus, Tag as TagIcon, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CategorySheet } from "@/components/categories/category-sheet";
import { Button, CategoryCard, ConfirmSheet, PopoverMenu, PopoverMenuDivider, PopoverMenuItem } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { DayEntryRow } from "@/components/today/day-entry-row";
import { RowActionsMenu, type RowMenuTarget } from "@/components/today/row-actions-menu";
import { categoryIcon, categoryTone } from "@/lib/v2/category-style";
import { useActions, useAllCategories, useAllItems, useDay } from "@/lib/v2/use-day";
import { useToday } from "@/lib/v2/use-today";

type Editing = { category: Category | null } | null;

/** Sections with today's counts (CAT-01…03): create, edit, reorder, archive, delete. */
export default function CategoriesPage() {
  const all = useAllCategories();
  const { items } = useAllItems();
  const run = useActions();
  const router = useRouter();
  const { notify } = useAddSheet();
  const today = useToday();
  const [open, setOpen] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [menu, setMenu] = useState<{ category: Category; anchor: HTMLElement } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [rowMenu, setRowMenu] = useState<RowMenuTarget>(null);
  const { entries } = useDay(today ?? "1970-01-01");

  const active = all.filter((c) => !c.archivedAt);
  const archived = all.filter((c) => c.archivedAt);
  const uncategorised = entries.filter((e) => !e.item.categoryId);
  const itemCount = (c: Category) => items.filter((i) => i.categoryId === c.id && !i.parentId).length;

  const card = (key: string, name: string, category: Category | undefined, mine: DayEntry[], index = -1) => {
    const p = dayProgress(mine);
    const Icon = categoryIcon(category);
    const actions = !category ? null : reordering ? (
      <div className="flex">
        <button
          type="button"
          aria-label={`Move ${name} up`}
          disabled={index === 0}
          onClick={() => void run((ctx) => moveCategory(active, category.id, -1, ctx))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-track disabled:opacity-30"
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Move ${name} down`}
          disabled={index === active.length - 1}
          onClick={() => void run((ctx) => moveCategory(active, category.id, 1, ctx))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-track disabled:opacity-30"
        >
          <ArrowDown className="h-4 w-4" aria-hidden />
        </button>
      </div>
    ) : (
      <button
        type="button"
        aria-label={`More actions for ${name}`}
        onClick={(e) => setMenu({ category, anchor: e.currentTarget })}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-track hover:text-ink"
      >
        <MoreHorizontal className="h-4.5 w-4.5" aria-hidden />
      </button>
    );
    return (
      <CategoryCard
        key={key}
        name={name}
        tone={categoryTone(category)}
        icon={<Icon className="h-4.5 w-4.5" />}
        done={p.done}
        total={p.required}
        expanded={!reordering && open === key}
        onToggle={() => setOpen(open === key ? null : key)}
        actions={actions}
      >
        {today
          ? mine.map((e) => <DayEntryRow key={e.key} entry={e} date={today} category={category} onMore={(entry, anchor) => setRowMenu({ entry, anchor })} />)
          : null}
        {mine.length === 0 ? <p className="py-1 text-[12px] text-ink-2">Nothing due today.</p> : null}
        {category ? (
          <Link href={`/categories/view?id=${category.id}`} className="flex min-h-8 items-center gap-1 text-[12px] font-medium text-link">
            All items in {name} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : null}
      </CategoryCard>
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink">Categories</h1>
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => router.push("/plans")}>
            Plans
          </Button>
          {active.length > 1 ? (
            <Button size="sm" variant="secondary" aria-pressed={reordering} onClick={() => setReordering((r) => !r)}>
              {reordering ? "Done" : "Reorder"}
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setEditing({ category: null })}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> New
          </Button>
        </div>
      </header>

      <div className="space-y-2">
        {active.map((c, i) => card(c.id, c.name, c, entries.filter((e) => e.item.categoryId === c.id), i))}
        {uncategorised.length && !reordering ? card("none", "No category", undefined, uncategorised) : null}
        {active.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 px-5 py-6 text-center">
            <p className="text-[14px] font-medium text-ink">No categories yet.</p>
            <p className="text-[12px] text-ink-2">Group your habits and tasks — Physical, University, Work…</p>
            <Button className="mt-1" onClick={() => setEditing({ category: null })}>
              <Plus className="h-4 w-4" aria-hidden /> New category
            </Button>
          </div>
        ) : null}
      </div>

      <Link href="/welcome?add=1" className="card flex min-h-11 items-center gap-2.5 px-3 text-[13px] text-ink">
        <Package className="h-4 w-4 text-ink-2" aria-hidden />
        <span className="flex-1">Add from starter packs</span>
        <ArrowRight className="h-4 w-4 text-ink-2" aria-hidden />
      </Link>

      {archived.length ? (
        <section aria-label="Archived categories">
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            className="min-h-9 text-[13px] font-medium text-ink-2 hover:text-ink"
          >
            Archived · {archived.length}
          </button>
          {showArchived ? (
            <ul className="mt-1 space-y-1.5">
              {archived.map((c) => {
                const Icon = categoryIcon(c);
                return (
                  <li key={c.id} className="card flex items-center gap-3 px-3 py-2">
                    <Icon className="h-4 w-4 text-ink-2" aria-hidden />
                    <Link href={`/categories/view?id=${c.id}`} className="min-w-0 flex-1 truncate text-[14px] text-ink-2">
                      {c.name}
                    </Link>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void run((ctx) => unarchiveCategory(c, items, ctx));
                        notify({ message: `Restored “${c.name}”` });
                      }}
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden /> Restore
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}

      {menu ? (
        <PopoverMenu anchor={menu.anchor} onClose={() => setMenu(null)} label={menu.category.name}>
          <PopoverMenuItem
            icon={<ArrowRight />}
            label="Open"
            onClick={() => {
              setMenu(null);
              router.push(`/categories/view?id=${menu.category.id}`);
            }}
          />
          <PopoverMenuItem
            icon={<Pencil />}
            label="Edit name, icon, colour"
            onClick={() => {
              setEditing({ category: menu.category });
              setMenu(null);
            }}
          />
          <PopoverMenuItem
            icon={<Archive />}
            label="Archive"
            onClick={() => {
              const c = menu.category;
              let stamp = "";
              void run((ctx) => {
                stamp = ctx.now;
                return archiveCategory(c, items, ctx);
              });
              setMenu(null);
              // Undo restores exactly what this archive hid (same timestamp).
              const restore = () => void run((ctx) => unarchiveCategory({ ...c, archivedAt: stamp }, items.map((i) => (i.categoryId === c.id && !i.archivedAt ? { ...i, archivedAt: stamp } : i)), ctx));
              notify({ message: `Archived “${c.name}”`, action: { label: "Undo", onClick: restore } });
            }}
          />
          <PopoverMenuDivider />
          <PopoverMenuItem
            icon={<Trash2 />}
            label="Delete"
            tone="danger"
            onClick={() => {
              setDeleting(menu.category);
              setMenu(null);
            }}
          />
        </PopoverMenu>
      ) : null}

      <CategorySheet open={editing !== null} category={editing?.category ?? null} onClose={() => setEditing(null)} />
      <ConfirmSheet
        open={deleting !== null}
        title={`Delete “${deleting?.name ?? ""}”?`}
        body={
          <p className="flex items-start gap-2">
            <TagIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {deleting && itemCount(deleting)
              ? itemCount(deleting) === 1
                ? "Its 1 item moves to “No category”. Its history is kept."
                : `Its ${itemCount(deleting)} items move to “No category”. Their history is kept.`
              : "This category has no items."}
          </p>
        }
        confirmLabel="Delete"
        onConfirm={() => {
          const c = deleting;
          if (c) void run((ctx) => deleteCategory(c, items, ctx));
        }}
        onClose={() => setDeleting(null)}
      />
      {today ? <RowActionsMenu key={rowMenu?.entry.key ?? "none"} target={rowMenu} date={today} today={today} onClose={() => setRowMenu(null)} /> : null}
    </div>
  );
}
