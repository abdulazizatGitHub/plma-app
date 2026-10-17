"use client";

import {
  dayRings,
  ANYTIME,
  bringBack,
  dayAccess,
  clockIn,
  dayParts,
  entryState,
  entryWindow,
  isPrayerGroup,
  carryOverIsha,
  windowEnd,
  prayerHeadline,
  prayerKeyOf,
  moveTo,
  partAt,
  partOf,
  type Category,
  type DayEntry,
  type DayPrayerTimes,
  type EntryState,
} from "@life/shared";
import { AlertTriangle, CalendarClock, Check, ChevronDown, ChevronRight, History, Hourglass, Plus, Telescope, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, DateStrip, SegmentedTabs, StatusTiles, Tag, addDays, weekStart, type ItemState } from "@/components/kit";
import { Tour } from "@/components/onboarding/tour";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { dayLabel, longDate, shortDate, whenLabel } from "@/lib/v2/dates";
import { categoryIcon, categoryTone, formatTime } from "@/lib/v2/category-style";
import { useActions, useCategories, useDay, useUserSettings, useDayStreak, useDays, useOverdue, usePending, usePrayerTimes, useUpcoming } from "@/lib/v2/use-day";
import { useNow } from "@/lib/v2/use-now";
import { useToday } from "@/lib/v2/use-today";
import { rowTransitionName, useSettledPlacement } from "@/lib/v2/use-settle";
import { DayEntryRow } from "./day-entry-row";
import { useRewards } from "@/lib/v2/use-rewards";
import { useSocial } from "@/lib/v2/use-social";
import { GettingStarted } from "@/components/onboarding/getting-started";
import { DaySummaryCard } from "./day-summary";
import { IshaCarryOver, PrayerGroup, headlineText } from "./prayer-group";
import { RowActionsMenu, type RowMenuTarget } from "./row-actions-menu";

const SECTIONS: { state: ItemState; title: string }[] = [
  { state: "todo", title: "To Do" },
  { state: "in_progress", title: "In Progress" },
  { state: "done", title: "Done" },
];
const DONE_PREVIEW = 3;

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

type View = "status" | "day";
const VIEW_KEY = "life_today_view";

function Section({ id, title, count, action, children }: { id?: string; title: string; count: number; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16 space-y-1.5" aria-label={title}>
      <h2 className="flex items-baseline gap-1.5 text-[15px] font-semibold text-ink">
        {title}
        <span className="text-[12px] font-normal text-ink-2">{count}</span>
        {action ? <span className="ml-auto">{action}</span> : null}
      </h2>
      {children}
    </section>
  );
}

/**
 * One group of Today's list (owner, 2026-10-13: "everything looks the same"):
 * a small header and a single card with thin dividers, instead of a card per
 * row. The header names what the rows share (a part of the day or a category).
 */
function Group({ title, count, icon, action, children }: { title: string; count: number; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="scroll-mt-16" aria-label={title}>
      <h2 className="mb-1.5 flex items-center gap-1.5 px-1 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">
        {icon}
        <span>{title}</span>
        <span className="font-normal">· {count}</span>
        {action ? <span className="ml-auto font-normal tracking-normal normal-case">{action}</span> : null}
      </h2>
      <div className="card divide-y divide-border overflow-hidden">{children}</div>
    </section>
  );
}

/** v2 Home: one day's To Do / In Progress / Done, plus Overdue and Upcoming (TOD-01…05, FLX-01…05). */
export function TodayScreen() {
  // Computed on the client: a prerendered page would freeze the build date.
  const today = useToday();
  const [date, setDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<ItemState | null>(null);
  const [menuFor, setMenuFor] = useState<RowMenuTarget>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const [showNotToday, setShowNotToday] = useState(false);
  const [view, setView] = useState<View>("day");
  const { openAdd, setDefaultDate, registerShowDay } = useAddSheet();
  const run = useActions();
  const { held, hold } = useSettledPlacement();

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
    // Per-device convenience; storage may be unavailable (private mode).
    try {
      if (localStorage.getItem(VIEW_KEY) === "status") setView("status"); // eslint-disable-line react-hooks/set-state-in-effect -- restore a saved preference
    } catch {
      /* keep the default */
    }
  }, []);
  const chooseView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* not saved; fine */
    }
  };
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
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart(day), i)), [day]);
  const weekDays = useDays(week);
  const marked = useMemo(() => new Set(week.filter((d) => (weekDays.get(d)?.entries.length ?? 0) > 0)), [week, weekDays]);
  const categories = useCategories();
  const byId = useMemo(() => new Map<string, Category>(categories.map((c) => [c.id, c])), [categories]);
  const pending = usePending();
  const isToday = date !== null && date === today;
  const settings = useUserSettings();
  const times = usePrayerTimes(date);
  const access = date && today ? dayAccess(date, today) : "live";
  const streak = useDayStreak(today);
  const { rewards } = useRewards();
  const now = useNow();
  const upcoming = useUpcoming(isToday ? today : null);
  // After midnight, yesterday's Isha is still on time until Fajr (owner, 2026-10-12).
  const yesterday = today ? addDays(today, -1) : null;
  const yesterdayDay = useDay(yesterday ?? "1970-01-01");
  const yesterdayTimes = usePrayerTimes(yesterday);
  const overdue = useOverdue(isToday ? today : null);
  const rings = useMemo(() => dayRings(entries, day, access === "history", settings), [entries, day, access, settings]);
  // A ring that just closed on this day pulses once.
  const [pulse, setPulse] = useState<string | null>(null);
  const { openSnap } = useSocial();
  const lastRings = useRef<{ day: string; closed: Record<string, boolean> } | null>(null);
  useEffect(() => {
    if (!ready) return;
    const closed = { prayer: !!rings.prayer?.closed, commit: !!rings.commit?.closed, balance: !!rings.balance?.closed };
    const before = lastRings.current;
    lastRings.current = { day, closed };
    if (!before || before.day !== day) return;
    const just = (Object.keys(closed) as (keyof typeof closed)[]).find((k) => closed[k] && !before.closed[k]);
    if (!just) return;
    setPulse(just); // a one-off pulse when a ring closes
    const t = setTimeout(() => setPulse(null), 700);
    return () => clearTimeout(t);
  }, [rings, day, ready]);

  if (!today || !date) {
    return <div className="skeleton h-40" aria-busy="true" aria-label="Loading today" />;
  }

  // A late day stays fixable until its window ends ("Thu, 12 AM").
  const fixUntil = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: settings.timezone })
    .format(windowEnd(date, settings.timezone, settings.dayEndHour))
    .replace(":00", "");
  // Prayers keep their own row up top; routines sort into the buckets like any item.
  const groups = entries.filter((e) => e.children && isPrayerGroup(e.item));
  const rows = entries.filter((e) => !(e.children && isPrayerGroup(e.item))).sort(byWindow(times));
  // Where a row is shown: its real state, unless it's being edited right now (it then
  // stays put and moves once it settles). Skipped / moved rows leave at once.
  const placed = (e: DayEntry): EntryState => {
    const real = entryState(e);
    return real === "not_today" ? real : (held.get(`${date}|${e.key}`) ?? real);
  };
  const bucket = (s: EntryState) => rows.filter((e) => placed(e) === s);
  const notToday = bucket("not_today");
  const nothing = ready && rows.length === 0 && groups.length === 0;
  const categoryOf = (e: DayEntry) => (e.item.categoryId ? byId.get(e.item.categoryId) : undefined);
  const row = (e: DayEntry, own?: string, dueLabel?: string, opts: { compact?: boolean; hideCategory?: boolean } = {}) => {
    const real = entryState(e);
    const shown = placed(e);
    return (
      <div key={`${own ?? date}|${e.key}`} style={{ viewTransitionName: rowTransitionName(`${own ?? date}|${e.key}`) }}>
        <DayEntryRow
          entry={e}
          date={own ?? date}
          category={categoryOf(e)}
          compact={opts.compact}
          hideCategory={opts.hideCategory}
          dueLabel={dueLabel}
          onInteract={own ? undefined : () => hold(`${date}|${e.key}`, shown)}
          movingTo={shown !== real ? real : undefined}
          onMore={(entry, anchor) => setMenuFor({ entry, anchor, date: own })}
        />
      </div>
    );
  };
  // What's next today: the next prayer or the next timed item still to do, whichever comes first.
  const nextUp = (() => {
    if (!isToday || !times) return null;
    const options: { at: number; label: string }[] = [];
    const prayerBlock = groups[0];
    if (prayerBlock?.children) {
      const nameOf = (key: string) => prayerBlock.children!.find((c) => prayerKeyOf(c.item) === key || (key === "dhuhr" && prayerKeyOf(c.item) === "zuhr"))?.item.title ?? key;
      const h = prayerHeadline(prayerBlock.children, date, today, now, times);
      const text = headlineText(h, now, times, nameOf);
      // The prayer whose time it is comes first: it is the obligation of the moment.
      if (text.current) options.push({ at: Number.NEGATIVE_INFINITY, label: text.current });
      else if (text.next && h.next) options.push({ at: h.next.at.getTime(), label: `next: ${text.next}` });
    }
    for (const e of rows) {
      const state = entryState(e);
      if (state === "done" || state === "not_today") continue;
      const w = entryWindow(e, times);
      if (!w || w.end.getTime() <= now.getTime()) continue;
      const startsLater = w.start.getTime() > now.getTime();
      options.push({ at: w.start.getTime(), label: startsLater ? `next: ${e.item.title} · ${formatTime(clockIn(w.start, times.timezone))}` : `${e.item.title} now` });
    }
    return options.sort((a, b) => a.at - b.at)[0]?.label ?? null;
  })();
  const goTo = (d: string) => {
    setDate(d);
    setFilter(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{dayLabel(date, today)}</h1>
          <p className="text-[12px] text-ink-2">{longDate(date)}</p>
          {isToday && overdue.length ? (
            // The ring is today's plan; overdue tasks belong to earlier days, so flag them here.
            <button
              type="button"
              onClick={() => document.getElementById("overdue")?.scrollIntoView({ behavior: "smooth" })}
              className="mt-1 inline-flex min-h-6 items-center gap-1 rounded-full bg-todo px-2 text-[11px] font-semibold text-on-fill"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden /> {overdue.length} overdue
            </button>
          ) : null}
        </div>

      </header>

      <div className="space-y-1.5">
        <DateStrip selected={date} today={today} marked={marked} onSelect={goTo} />
        {!isToday ? (
          <div className="flex justify-center">
            <button type="button" onClick={() => goTo(today)} className="min-h-8 rounded-full bg-track px-3 text-[12px] font-medium text-ink hover:bg-border">
              Back to today
            </button>
          </div>
        ) : null}
      </div>

      {access !== "live" ? (
        <p role="note" className="flex items-start gap-2 rounded-xl bg-track px-3 py-2.5 text-[12.5px] text-ink">
          <span className="mt-0.5 text-ink-2 [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
            {access === "late" ? <Hourglass /> : access === "history" ? <History /> : <Telescope />}
          </span>
          <span>
            {access === "late"
              ? `Still open — you can fix this day until ${fixUntil}. Changes you make now are marked late.`
              : access === "history"
                ? "This day is closed and its progress is final. Unfinished tasks can still be moved to today, and missed prayers recovered as qada. (When your day ends: Profile → Your day.)"
                : "Planning ahead: add, skip or move things here. You can tick them when the day comes."}
          </span>
        </p>
      ) : null}

      <div data-tour="ring">
        <DaySummaryCard
          access={access}
          rows={rows}
          progress={progress}
          rings={rings}
          pulse={pulse}
          onShare={access === "live" ? () => openSnap({ kind: "day", label: "today's rings" }) : undefined}
          date={date}
          today={today}
          streak={streak}
          nextUp={nextUp}
          fixUntil={access === "late" ? fixUntil : undefined}
          rewards={access === "live" ? rewards : null}
        />
      </div>

      {isToday ? <GettingStarted rings={rings} /> : null}
      <div data-tour="tiles">
      <StatusTiles
        counts={{ todo: progress.counts.todo, in_progress: progress.counts.in_progress, done: progress.counts.done }}
        selected={filter}
        onSelect={setFilter}
      />
      </div>

      {rows.length ? (
        <SegmentedTabs<View>
          label="Group by"
          value={view}
          onChange={chooseView}
          options={[
            { value: "day", label: "My day" },
            { value: "status", label: "By status" },
          ]}
        />
      ) : null}

      {overdue.length && !filter ? (
        <Section id="overdue" title="Overdue" count={overdue.length}>
          {overdue.map((e) => {
            const was = e.item.schedule.kind === "once" ? (e.item.schedule.date ?? date) : date;
            return (
              <div key={e.key}>
                {row(e, was, `Was due ${shortDate(was)}`)}
                <div className="-mt-0.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void run((ctx) => moveTo(e, was, today, ctx))}
                    className="min-h-7 rounded-full px-2.5 text-[12px] font-medium text-link hover:bg-track"
                  >
                    Move to today
                  </button>
                </div>
              </div>
            );
          })}
        </Section>
      ) : null}

      {(() => {
        if (!isToday || !yesterday || !yesterdayTimes) return null;
        const block = yesterdayDay.entries.find((e) => e.children && isPrayerGroup(e.item));
        const isha = block?.children ? carryOverIsha(block.children, yesterday, today, now, yesterdayTimes) : null;
        return isha ? <IshaCarryOver entry={isha} date={yesterday} times={yesterdayTimes} /> : null;
      })()}
      {groups.map((g) => (
        <PrayerGroup key={g.key} entry={g} date={date} />
      ))}

      <div data-tour="list" className="space-y-5">
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
              <p className="text-[12px] text-ink-2">
                {access === "planned" ? "Plan ahead: add a task for that day." : "Add something, or enjoy the free day — it still counts as 100%."}
              </p>
              <Button onClick={openAdd} className="mt-1">
                <Plus className="h-4 w-4" aria-hidden /> Add a task
              </Button>
            </>
          )}
        </div>
      ) : view === "day" ? (
        (() => {
          // My day (owner, 2026-10-13): timed items by part of the day ("now" marked),
          // untimed ones by category, finished ones folded into Done at the end.
          const parts = times ? dayParts(times) : [];
          const current = isToday && times ? partAt(now, parts) : null;
          const live = rows.filter((e) => placed(e) !== "not_today" && (!filter || placed(e) === filter));
          const open = filter === "done" ? live : live.filter((e) => placed(e) !== "done");
          const done = filter ? [] : live.filter((e) => placed(e) === "done");
          const partKey = (e: DayEntry) => (times ? partOf(e, times, parts) : ANYTIME);
          const timed = parts
            .map((p) => ({ part: p, list: open.filter((e) => partKey(e) === p.key) }))
            .filter((g) => g.list.length);
          const anytime = open.filter((e) => partKey(e) === ANYTIME);
          const cats = [...categories.map((c) => ({ id: c.id as string | null, cat: c as Category | undefined })), { id: null, cat: undefined }]
            .map(({ id, cat }) => ({ cat, list: anytime.filter((e) => (e.item.categoryId ?? null) === id || (id === null && e.item.categoryId && !byId.has(e.item.categoryId))) }))
            .filter((g) => g.list.length);
          const doneShown = showAllDone ? done : done.slice(0, 0);
          return (
            <>
              {timed.map(({ part, list }) => (
                <Group
                  key={part.key}
                  title={part.label}
                  count={list.length}
                  action={
                    <span className="flex items-center gap-1.5 text-[11.5px] text-ink-2">
                      {current === part.key ? <Tag tone="primary">Now</Tag> : null}
                      {times ? `${formatTime(clockIn(part.window.start, times.timezone))} – ${formatTime(clockIn(part.window.end, times.timezone))}` : null}
                    </span>
                  }
                >
                  {list.map((e) => row(e, undefined, undefined, { compact: true }))}
                </Group>
              ))}
              {cats.map(({ cat, list }) => {
                const Icon = categoryIcon(cat);
                return (
                  <Group
                    key={cat?.id ?? "none"}
                    title={cat?.name ?? "Other"}
                    count={list.length}
                    icon={
                      <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: cat ? `var(--cat-${categoryTone(cat)})` : "var(--track)" }}>
                        <Icon className="h-3 w-3 text-ink" />
                      </span>
                    }
                  >
                    {list.map((e) => row(e, undefined, undefined, { compact: true, hideCategory: true }))}
                  </Group>
                );
              })}
              {done.length ? (
                <section aria-label="Done">
                  <button
                    type="button"
                    aria-expanded={showAllDone}
                    onClick={() => setShowAllDone((v) => !v)}
                    className="flex min-h-9 items-center gap-1.5 px-1 text-[12px] font-semibold tracking-wide text-ink-2 uppercase hover:text-ink"
                  >
                    <Check className="h-3.5 w-3.5 text-done" aria-hidden /> Done · {done.length}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllDone ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                  {doneShown.length ? <div className="card mt-1 divide-y divide-border overflow-hidden">{doneShown.map((e) => row(e, undefined, undefined, { compact: true }))}</div> : null}
                </section>
              ) : null}
            </>
          );
        })()
      ) : (
        SECTIONS.filter((s) => !filter || filter === s.state).map(({ state, title }) => {
          const list = bucket(state);
          if (!list.length) return null;
          const shown = state === "done" && !showAllDone && !filter ? list.slice(0, DONE_PREVIEW) : list;
          return (
            <Group key={state} title={state === "todo" && access === "history" ? "Not done" : state === "todo" && access === "planned" ? "Planned" : title} count={list.length}>
              {shown.map((e) => row(e, undefined, undefined, { compact: true }))}
              {shown.length < list.length ? (
                <button type="button" onClick={() => setShowAllDone(true)} className="min-h-10 w-full text-[12px] font-medium text-link">
                  Show all {list.length}
                </button>
              ) : null}
            </Group>
          );
        })
      )}
      </div>

      {notToday.length && !filter ? (
        <section aria-label="Not today">
          <button
            type="button"
            aria-expanded={showNotToday}
            onClick={() => setShowNotToday((v) => !v)}
            className="min-h-9 text-[13px] font-medium text-ink-2 hover:text-ink"
          >
            Not today · {notToday.length}
          </button>
          {showNotToday ? (
            <ul className="mt-1 space-y-1.5">
              {notToday.map((e) => (
                <li key={e.key} className="card flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-ink-2">{e.item.title}</p>
                    <p className="text-[12px] text-ink-2">
                      {e.occurrence?.status === "moved" && e.occurrence.movedTo ? `Moved to ${shortDate(e.occurrence.movedTo)}` : "Skipped"}
                    </p>
                  </div>
                  {e.occurrence?.status === "skipped" && access !== "history" ? (
                    <Button size="sm" variant="secondary" onClick={() => void run((ctx) => bringBack(e, date, ctx))}>
                      <Undo2 className="h-3.5 w-3.5" aria-hidden /> Bring back
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {upcoming.length && !filter ? (
        <Section title="Upcoming" count={upcoming.reduce((n, g) => n + g.entries.length, 0)}>
          <div className="space-y-3">
            {upcoming.map((g) => (
              <div key={g.date} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => goTo(g.date)}
                  className="flex min-h-7 w-full items-center gap-1 text-left text-[12px] font-medium text-ink-2 hover:text-ink"
                >
                  {whenLabel(g.date, today)}
                  <span className="text-ink-2">({g.entries.length})</span>
                  <ChevronRight className="ml-auto h-4 w-4" aria-hidden />
                </button>
                {[...g.entries].sort(byTime).map((e) => row(e, g.date))}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {pending.length ? (
        <Link href="/pending" className="card flex min-h-11 items-center gap-2.5 px-3 text-[14px] text-ink">
          <CalendarClock className="h-4 w-4 text-ink-2" aria-hidden />
          <span className="flex-1">Pending</span>
          <span className="text-[12px] text-ink-2">{pending.length}</span>
          <ChevronRight className="h-4 w-4 text-ink-2" aria-hidden />
        </Link>
      ) : null}

      <Tour ready={ready && isToday} />
      <RowActionsMenu key={menuFor ? `${menuFor.date ?? date}|${menuFor.entry.key}` : "none"} target={menuFor} date={date} today={today} onClose={() => setMenuFor(null)} />
    </div>
  );
}
