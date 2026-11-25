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
import { AlertTriangle, Calendar as CalendarIcon, CalendarClock, ChevronRight, CircleCheck, ListTodo, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Calendar, Sheet, addDays } from "@/components/kit";
import { Tour } from "@/components/onboarding/tour";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { dayLabel, longDate, shortDate } from "@/lib/v2/dates";
import { useActions, useCategories, useDay, useUserSettings, useOverdue, usePending, usePrayerTimes } from "@/lib/v2/use-day";
import { useNow } from "@/lib/v2/use-now";
import { useToday } from "@/lib/v2/use-today";
import { GettingStarted } from "@/components/onboarding/getting-started";
import { HabitRow, ListCard } from "./habit-row";
import { IshaCarryOver, PrayerGroup } from "./prayer-group";
import { RowActionsMenu, type RowMenuTarget } from "./row-actions-menu";
import { TodaySummary } from "./today-summary";

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

/** "3/7": done of required in a list (a routine counts its steps; skipped and optional items don't count). */
function listCount(list: DayEntry[]): string {
  let required = 0;
  let done = 0;
  for (const u of list.flatMap((e) => e.children ?? [e])) {
    const s = entryState(u);
    if (s === "not_today" || u.item.isOptional) continue;
    required += 1;
    if (s === "done") done += 1;
  }
  return required ? `${done}/${required}` : "";
}

/**
 * v2 Home, simplified (owner mockup, 2026-11-25 — users found the old Today too
 * complex): the day's title with a calendar, one summary ring, the prayer card,
 * and one card per list (My Habits, Tasks). Rows stay where they are when ticked.
 * Other days open from the calendar; Overdue appears only when something is.
 */
export function TodayScreen() {
  // Computed on the client: a prerendered page would freeze the build date.
  const today = useToday();
  const [date, setDate] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<RowMenuTarget>(null);
  const [picking, setPicking] = useState(false);
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
  // In the day's order; skipped and moved rows go to the end of their list.
  const rows = entries
    .filter((e) => !(e.children && isPrayerGroup(e.item)))
    .sort(byWindow(times))
    .sort((a, b) => Number(entryState(a) === "not_today") - Number(entryState(b) === "not_today"));
  const isTask = (e: DayEntry) => e.item.schedule.kind === "once" || Boolean(e.plan);
  const habits = rows.filter((e) => !isTask(e));
  const tasks = rows.filter(isTask);
  const nothing = ready && rows.length === 0 && prayerBlocks.length === 0;
  const categoryOf = (e: DayEntry) => (e.item.categoryId ? byId.get(e.item.categoryId) : undefined);
  const onMenu = (date?: string) => (entry: DayEntry, anchor: HTMLElement) => setMenuFor({ entry, anchor, date });
  const goTo = (d: string) => {
    setDate(d);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-semibold text-ink">{dayLabel(date, today)}</h1>
          <p className="text-[14px] text-ink-2">{longDate(date)}</p>
          {!isToday ? (
            <button type="button" onClick={() => goTo(today)} className="mt-1.5 min-h-8 rounded-full bg-track px-3 text-[12.5px] font-medium text-ink hover:bg-border">
              Back to today
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label="Pick a day"
          className="-mr-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-track"
        >
          <CalendarIcon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      <div data-tour="ring">
        <TodaySummary access={access} progress={progress} fixUntil={access === "late" ? fixUntil : undefined} />
      </div>

      {isToday ? <GettingStarted rings={rings} /> : null}

      {overdue.length ? (
        <ListCard title="Overdue" icon={<AlertTriangle />} tone="todo" count={String(overdue.length)}>
          {overdue.map((e) => {
            const was = e.item.schedule.kind === "once" ? (e.item.schedule.date ?? date) : date;
            return (
              <HabitRow
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
                    className="-mr-1.5 min-h-9 rounded-full px-2.5 text-[13px] font-medium whitespace-nowrap text-link hover:bg-track"
                  >
                    Move to today
                  </button>
                }
              />
            );
          })}
        </ListCard>
      ) : null}

      {(() => {
        if (!isToday || !yesterday || !yesterdayTimes) return null;
        const block = yesterdayDay.entries.find((e) => e.children && isPrayerGroup(e.item));
        const isha = block?.children ? carryOverIsha(block.children, yesterday, today, now, yesterdayTimes) : null;
        return isha ? <IshaCarryOver entry={isha} date={yesterday} times={yesterdayTimes} /> : null;
      })()}
      {prayerBlocks.map((g) => (
        <PrayerGroup key={g.key} entry={g} date={date} />
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

      <div data-tour={habits.length || tasks.length ? "list" : undefined} className="space-y-4">
        {habits.length ? (
          <ListCard title="My Habits" icon={<CircleCheck />} count={listCount(habits)}>
            {habits.map((e) => (
              <HabitRow key={`${date}|${e.key}`} entry={e} date={date} category={categoryOf(e)} onMenu={onMenu()} />
            ))}
          </ListCard>
        ) : null}
        {tasks.length ? (
          <ListCard title="Tasks" icon={<ListTodo />} count={listCount(tasks)}>
            {tasks.map((e) => (
              <HabitRow key={`${date}|${e.key}`} entry={e} date={date} category={categoryOf(e)} onMenu={onMenu()} />
            ))}
          </ListCard>
        ) : null}
      </div>

      {pending.length ? (
        <Link href="/pending" className="card flex min-h-12 items-center gap-2.5 px-3.5 text-[14px] text-ink">
          <CalendarClock className="h-4.5 w-4.5 text-ink-2" aria-hidden />
          <span className="flex-1">Pending — no date yet</span>
          <span className="text-[13px] text-ink-2">{pending.length}</span>
          <ChevronRight className="h-4 w-4 text-ink-2" aria-hidden />
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
