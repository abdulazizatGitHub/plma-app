"use client";

import {
  dayRings,
  dayAccess,
  entryState,
  entryWindow,
  isPrayerGroup,
  carryOverIsha,
  windowEnd,
  moveTo,
  type Category,
  type DayEntry,
  type DayPrayerTimes,
} from "@life/shared";
import { Calendar as CalendarIcon, CalendarClock, ChevronRight, History, Hourglass, MoreHorizontal, Plus, Telescope } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { Button, Calendar, PopoverMenu, PopoverMenuItem, Sheet, addDays } from "@/components/kit";
import { Tour } from "@/components/onboarding/tour";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { dayLabel, shortDate } from "@/lib/v2/dates";
import { categoryIcon } from "@/lib/v2/category-style";
import { useActions, useCategories, useDay, useUserSettings, useOverdue, usePending, usePrayerTimes } from "@/lib/v2/use-day";
import { useNow } from "@/lib/v2/use-now";
import { useToday } from "@/lib/v2/use-today";
import { GettingStarted } from "@/components/onboarding/getting-started";
import { ItemCard } from "./item-card";
import { IshaCarryOver, PrayerGroup } from "./prayer-group";
import { RowActionsMenu, type RowMenuTarget } from "./row-actions-menu";

/** Timed tasks first, by time; then the rest in their saved order (lists without prayer times). */
const byTime = (a: DayEntry, b: DayEntry) => {
  const ta = a.item.schedule.kind === "once" ? (a.item.schedule.time ?? "99:99") : "99:99";
  const tb = b.item.schedule.kind === "once" ? (b.item.schedule.time ?? "99:99") : "99:99";
  return ta.localeCompare(tb) || a.item.sortOrder - b.item.sortOrder;
};

/** By when they happen in the day (time, or prayer window), then saved order. */
const byWindow = (times: DayPrayerTimes | null) => (a: DayEntry, b: DayEntry) => {
  if (!times) return byTime(a, b);
  const ka = entryWindow(a, times)?.start.getTime() ?? Infinity;
  const kb = entryWindow(b, times)?.start.getTime() ?? Infinity;
  return ka - kb || a.item.sortOrder - b.item.sortOrder;
};

/** "Wed, 25 Nov". */
const SHORT_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const dateLine = (iso: string) => SHORT_DAY.format(new Date(`${iso}T12:00:00`)).replace(/^(\w+) /, "$1, ");

/** A filter pill: All, or one category with its icon. */
function FilterChip({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`transition-token flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-medium whitespace-nowrap ${
        active ? "bg-primary-strong text-on-primary-strong" : "bg-surface text-ink shadow-(--shadow-card) hover:bg-track in-data-[mode=dark]:border in-data-[mode=dark]:border-border"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * v2 Home (owner mockup, 2026-11-26): "Today" with the date and a calendar, a
 * small progress box, category filters, the prayer card, then one card per
 * item. Tapping an item opens its page; its circle ticks it. Overdue and
 * Pending show only when they have something.
 */
export function TodayScreen() {
  // Computed on the client: a prerendered page would freeze the build date.
  const today = useToday();
  const router = useRouter();
  const [date, setDate] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<RowMenuTarget>(null);
  const [picking, setPicking] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [moreAt, setMoreAt] = useState<HTMLElement | null>(null);
  const { openAdd, setDefaultDate, registerShowDay } = useAddSheet();
  const run = useActions();

  // Follows the calendar: at midnight (or when the app comes back), a screen that was
  // showing "today" moves to the new today; a screen showing another day stays there.
  const shownToday = useRef<string | null>(null);
  useEffect(() => {
    if (!today) return;
    // "/?date=YYYY-MM-DD" (from Progress) opens that day once; otherwise follow today.
    let asked: string | null = null;
    try {
      asked = new URLSearchParams(window.location.search).get("date");
    } catch {
      /* no URL */
    }
    const wanted = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && shownToday.current === null ? asked : null;
    setDate((d) => wanted ?? (d === null || d === shownToday.current ? today : d));
    shownToday.current = today;
  }, [today]);
  useEffect(() => {
    // "+" on a past day adds to today: a new task can't start life in the past.
    setDefaultDate(date && today && date < today ? today : date);
    return () => setDefaultDate(null);
  }, [date, today, setDefaultDate]);
  useEffect(() => {
    // The "View" button on the add confirmation jumps here.
    registerShowDay((d) => {
      setDate(d);
      setFilter(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    return () => registerShowDay(null);
  }, [registerShowDay]);

  const day = date ?? "1970-01-01";
  const { entries, progress, ready } = useDay(day);
  const categories = useCategories();
  const byId = useMemo(() => new Map<string, Category>(categories.map((c) => [c.id, c])), [categories]);
  const pending = usePending();
  const isToday = date !== null && date === today;
  const settings = useUserSettings();
  const times = usePrayerTimes(date);
  const access = date && today ? dayAccess(date, today) : "live";
  const now = useNow();
  // After midnight, yesterday's Isha is still on time until Fajr (owner, 2026-10-12).
  const yesterday = today ? addDays(today, -1) : null;
  const yesterdayDay = useDay(yesterday ?? "1970-01-01");
  const yesterdayTimes = usePrayerTimes(yesterday);
  const overdue = useOverdue(isToday ? today : null);
  const rings = useMemo(() => dayRings(entries, day, access === "history", settings), [entries, day, access, settings]);

  if (!today || !date) {
    return <div className="skeleton h-40" aria-busy="true" aria-label="Loading today" />;
  }

  // A late day stays fixable until its window ends ("Thu, 12 AM").
  const fixUntil = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: settings.timezone })
    .format(windowEnd(date, settings.timezone, settings.dayEndHour))
    .replace(":00", "");
  const prayerBlocks = entries.filter((e) => e.children && isPrayerGroup(e.item));
  // In the day's order; skipped and moved rows go to the end.
  const rows = entries
    .filter((e) => !(e.children && isPrayerGroup(e.item)))
    .sort(byWindow(times))
    .sort((a, b) => Number(entryState(a) === "not_today") - Number(entryState(b) === "not_today"));
  const categoryOf = (e: DayEntry) => (e.item.categoryId ? byId.get(e.item.categoryId) : undefined);
  // Filters: the categories that have something on this day, in their saved order.
  const present = new Set([...rows, ...prayerBlocks].map((e) => e.item.categoryId).filter(Boolean));
  const chips = categories.filter((c) => present.has(c.id));
  const active = filter && chips.some((c) => c.id === filter) ? filter : null;
  const matches = (e: DayEntry) => !active || e.item.categoryId === active;
  const shown = rows.filter(matches);
  const prayersShown = prayerBlocks.filter(matches);
  const nothing = ready && rows.length === 0 && prayerBlocks.length === 0;
  const onMenu = (own?: string) => (entry: DayEntry, anchor: HTMLElement) => setMenuFor({ entry, anchor, date: own });
  const goTo = (d: string) => {
    setDate(d);
    setFilter(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const { done, required, pct } = progress;
  const note =
    access === "late"
      ? { icon: <Hourglass />, text: `Still open — you can fix this day until ${fixUntil}. Changes now are marked late.` }
      : access === "history"
        ? { icon: <History />, text: "This day is closed and its progress is final. Unfinished tasks can still be moved to today." }
        : access === "planned"
          ? { icon: <Telescope />, text: "Planning ahead: add, skip or move things here. You can tick them when the day comes." }
          : null;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-semibold text-ink">{dayLabel(date, today)}</h1>
          <p className="flex items-center gap-1 text-[15px] text-ink-2">
            {dateLine(date)}
            <button
              type="button"
              onClick={() => setPicking(true)}
              aria-label="Pick a day"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track hover:text-ink"
            >
              <CalendarIcon className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />
            </button>
          </p>
        </div>
        <section
          data-tour="ring"
          aria-label="Day summary"
          className="card w-[44%] max-w-52 shrink-0 px-4 py-3.5"
        >
          <p className="text-[19px] leading-tight font-semibold text-ink tabular-nums">{access === "planned" ? `${required} planned` : `${done} / ${required}`}</p>
          <div role="img" aria-label={`${pct}% of the day done`} data-value={access === "planned" ? 0 : pct} className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full bg-primary transition-[width] duration-(--duration-slow) ease-(--ease-standard)" style={{ width: `${access === "planned" ? 0 : pct}%` }} />
          </div>
        </section>
      </header>

      {!isToday ? (
        <button type="button" onClick={() => goTo(today)} className="min-h-9 rounded-full bg-track px-3.5 text-[13px] font-medium text-ink hover:bg-border">
          Back to today
        </button>
      ) : null}
      {note ? (
        <p role="note" className="flex items-start gap-2 rounded-xl bg-track px-3 py-2.5 text-[13px] text-ink">
          <span className="mt-0.5 text-ink-2 [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
            {note.icon}
          </span>
          <span>{note.text}</span>
        </p>
      ) : null}

      {chips.length > 1 ? (
        <div role="group" aria-label="Show a category" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:-mx-6 md:px-6">
          <FilterChip active={!active} onClick={() => setFilter(null)}>
            All
          </FilterChip>
          {chips.map((c) => (
            <FilterChip key={c.id} active={active === c.id} onClick={() => setFilter(active === c.id ? null : c.id)} icon={createElement(categoryIcon(c), { className: "h-4.5 w-4.5", strokeWidth: 1.75, "aria-hidden": true })}>
              {c.name}
            </FilterChip>
          ))}
          <button
            type="button"
            aria-label="All categories"
            aria-haspopup="menu"
            onClick={(e) => setMoreAt(e.currentTarget)}
            className="flex min-h-10 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-(--shadow-card) hover:bg-track in-data-[mode=dark]:border in-data-[mode=dark]:border-border"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </button>
          {moreAt ? (
            <PopoverMenu anchor={moreAt} onClose={() => setMoreAt(null)} label="Show a category">
              <PopoverMenuItem label="All" onClick={() => (setFilter(null), setMoreAt(null))} />
              {chips.map((c) => (
                <PopoverMenuItem key={c.id} icon={createElement(categoryIcon(c))} label={c.name} onClick={() => (setFilter(c.id), setMoreAt(null))} />
              ))}
            </PopoverMenu>
          ) : null}
        </div>
      ) : null}

      {isToday ? <GettingStarted rings={rings} /> : null}

      {overdue.length && !active ? (
        <section aria-label="Overdue" className="space-y-2">
          <h2 className="px-1 text-[15px] font-semibold text-ink">
            Overdue <span className="font-normal text-ink-2">· {overdue.length}</span>
          </h2>
          <ul className="space-y-2.5">
            {overdue.map((e) => {
              const was = e.item.schedule.kind === "once" ? (e.item.schedule.date ?? date) : date;
              return (
                <ItemCard
                  key={e.key}
                  entry={e}
                  date={was}
                  category={categoryOf(e)}
                  dueLabel={`Was due ${shortDate(was)}`}
                  onMenu={onMenu(was)}
                  aside={
                    <button
                      type="button"
                      onClick={() => void run((ctx) => moveTo(e, was, today, ctx))}
                      className="-mr-1 min-h-9 shrink-0 rounded-full bg-track px-3 text-[13px] font-medium whitespace-nowrap text-ink hover:bg-border"
                    >
                      Move to today
                    </button>
                  }
                />
              );
            })}
          </ul>
        </section>
      ) : null}

      {(() => {
        if (!isToday || !yesterday || !yesterdayTimes) return null;
        const block = yesterdayDay.entries.find((e) => e.children && isPrayerGroup(e.item));
        const isha = block?.children ? carryOverIsha(block.children, yesterday, today, now, yesterdayTimes) : null;
        return isha ? <IshaCarryOver entry={isha} date={yesterday} times={yesterdayTimes} /> : null;
      })()}
      {prayersShown.map((g) => (
        <PrayerGroup key={g.key} entry={g} date={date} onOpen={() => router.push(`/items/view?id=${g.item.id}`)} />
      ))}

      {nothing ? (
        <div className="card flex flex-col items-center gap-2 px-5 py-6 text-center">
          {access === "late" || access === "history" ? (
            // A past day can't be planned any more; say what it was instead of inviting edits.
            <p className="text-[14px] font-medium text-ink">Nothing was planned for {dayLabel(date, today).toLowerCase()}.</p>
          ) : (
            <>
              <p className="text-[14px] font-medium text-ink">
                Nothing planned for {dayLabel(date, today).toLowerCase()}
                {access === "planned" ? " yet" : ""}.
              </p>
              <p className="text-[12.5px] text-ink-2">{access === "planned" ? "Plan ahead: add a task for that day." : "Add something, or enjoy the free day — it still counts as 100%."}</p>
              <Button onClick={openAdd} className="mt-1">
                <Plus className="h-4 w-4" aria-hidden /> Add a task
              </Button>
            </>
          )}
        </div>
      ) : null}

      {shown.length ? (
        <ul data-tour="list" aria-label="Items" className="space-y-2.5">
          {shown.map((e) => (
            <ItemCard key={`${date}|${e.key}`} entry={e} date={date} category={categoryOf(e)} onMenu={onMenu()} />
          ))}
        </ul>
      ) : active && !prayersShown.length ? (
        <p className="card px-4 py-3 text-[13.5px] text-ink-2">Nothing in {byId.get(active)?.name ?? "this category"} on this day.</p>
      ) : null}

      {pending.length && !active ? (
        <Link href="/pending" className="card flex min-h-13 items-center gap-3 px-4 text-[15px] text-ink">
          <CalendarClock className="h-5 w-5 text-ink-2" aria-hidden />
          <span className="flex-1">Pending — no date yet</span>
          <span className="text-[13.5px] text-ink-2">{pending.length}</span>
          <ChevronRight className="h-4.5 w-4.5 text-ink-2" aria-hidden />
        </Link>
      ) : null}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Go to a day">
        <Calendar
          value={date}
          today={today}
          onChange={(d) => {
            goTo(d);
            setPicking(false);
          }}
        />
        {!isToday ? (
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => {
              goTo(today);
              setPicking(false);
            }}
          >
            Back to today
          </Button>
        ) : null}
      </Sheet>

      <Tour ready={ready && isToday} />
      <RowActionsMenu key={menuFor ? `${menuFor.date ?? date}|${menuFor.entry.key}` : "none"} target={menuFor} date={date} today={today} onClose={() => setMenuFor(null)} />
    </div>
  );
}
