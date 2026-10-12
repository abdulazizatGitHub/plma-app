"use client";

import {
  anchorWindow,
  canLog,
  clockIn,
  dayAccess,
  markPrayer,
  normalisePrayerKey,
  prayerDisplay,
  prayerHeadline,
  prayerKeyOf,
  prayerMark,
  prayerTiming,
  weekdayOf,
  type DayEntry,
  type DayPrayerTimes,
  type PrayerHeadline,
  type PrayerMark,
  type PrayerTimeKey,
} from "@life/shared";
import {
  BarChart3,
  Check,
  CheckCheck,
  CircleSlash,
  Clock4,
  MapPin,
  MoreHorizontal,
  Settings2,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PopoverMenu,
  PopoverMenuDivider,
  PopoverMenuItem,
  PrayerRow,
  Sheet,
  type PrayerChip,
} from "@/components/kit";
import { useLocation } from "@/components/location/location-provider";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { formatTime } from "@/lib/v2/category-style";
import { longDate } from "@/lib/v2/dates";
import { useActions, usePrayerTimes, useUserSettings } from "@/lib/v2/use-day";
import { useNow } from "@/lib/v2/use-now";
import { useToday } from "@/lib/v2/use-today";

const CHIP: Record<PrayerMark, PrayerChip["status"]> = {
  prayed: "done",
  qada: "qada",
  missed: "missed",
  open: "open",
};
const TIME_KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
const NAMES: Record<string, string> = {
  fajr: "Fajr",
  sunrise: "Sunrise",
  dhuhr: "Zuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

const inMinutes = (from: Date, to: Date) => {
  const m = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

/**
 * "Isha now · until 4:48 AM tomorrow · best before 11:52 PM", or the next one:
 * "Fajr tomorrow · 4:48 AM" / "Asr at 3:59 PM (in 40 min)". Shared by the
 * prayer block and the Today card so they always agree.
 */
export function headlineText(
  h: PrayerHeadline,
  now: Date,
  times: DayPrayerTimes,
  nameOf: (key: string) => string,
): { current: string | null; next: string | null } {
  const fmt = (d: Date) => formatTime(clockIn(d, times.timezone));
  let current: string | null = null;
  if (h.current) {
    const { timing } = h.current;
    const best =
      timing.preferredEnd && timing.preferredEnd > now
        ? ` · best before ${fmt(timing.preferredEnd)}`
        : "";
    const tomorrow =
      timing.endsNextDay &&
      timing.end.getTime() - now.getTime() > 0 &&
      clockIn(now, times.timezone) >= "12:00"
        ? " tomorrow"
        : "";
    current = `${nameOf(timing.key)} now · until ${fmt(timing.end)}${tomorrow}${best}`;
  }
  const next = h.next
    ? h.next.tomorrow
      ? `${nameOf(h.next.key)} tomorrow · ${fmt(h.next.at)}`
      : `${nameOf(h.next.key)} at ${fmt(h.next.at)} (in ${inMinutes(now, h.next.at)})`
    : null;
  return { current, next };
}

/** A prayer's time on this day: its calculated time, or its anchor's start (e.g. Tahajjud). */
function chipTime(
  child: DayEntry,
  times: DayPrayerTimes | null,
): string | undefined {
  if (!times) return undefined;
  const key = normalisePrayerKey(prayerKeyOf(child.item) ?? "");
  if (TIME_KEYS.includes(key))
    return formatTime(times.clock[key as PrayerTimeKey]);
  const s = child.item.schedule;
  const w =
    s.kind !== "once" && s.anchor ? anchorWindow(s.anchor, times) : null;
  return w ? formatTime(clockIn(w.start, times.timezone)) : undefined;
}

/**
 * The prayer block (PRY-03/04, PRY-08/09, TOD-07): one tap per prayer, any
 * order; hold a chip (or ⋯) for prayed late (qada), missed or clear. Past
 * days show unmarked prayers as missed, ready to recover as qada.
 */
export function PrayerGroup({
  entry,
  date,
}: {
  entry: DayEntry;
  date: string;
}) {
  const run = useActions();
  const router = useRouter();
  const settings = useUserSettings();
  const times = usePrayerTimes(date);
  const now = useNow();
  const { ensure } = useLocation();
  const [chipMenu, setChipMenu] = useState<{
    child: DayEntry;
    anchor: HTMLElement;
  } | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const today = useToday() ?? date;
  const isToday = date === today;
  const children = entry.children ?? [];
  const friday = weekdayOf(date) === 5 && settings.jumuahLabel;
  const label = (c: DayEntry) =>
    friday && prayerKeyOf(c.item) === "dhuhr" ? "Jumu'ah" : c.item.title;
  const mark = (child: DayEntry, m: Parameters<typeof markPrayer>[2]) =>
    void run((ctx) => markPrayer(child, date, m, ctx));
  // Today: one tap = prayed. Past days: one tap = qada (made up later). Future: can't mark yet.
  const access = dayAccess(date, today);
  const markable = access !== "planned";
  const tapMark = access === "live" ? "prayed" : "qada";
  // "On time" stays available for yesterday (prayed but forgot to tap); older days only qada / missed.
  const offerOnTime = canLog(access);
  const { notify } = useAddSheet();
  const display = (c: DayEntry) => prayerDisplay(c, date, today, now, times);
  const headline =
    isToday && times ? prayerHeadline(children, date, today, now, times) : null;

  const nameOf = (key: string) => {
    const child = children.find(
      (c) => normalisePrayerKey(prayerKeyOf(c.item) ?? "") === key,
    );
    return child ? label(child) : (NAMES[key] ?? key);
  };
  let subtitle: string | undefined;
  if (headline && times) {
    const text = headlineText(headline, now, times, nameOf);
    subtitle = text.current?.split(" · best before")[0] ?? (text.next ? `Next: ${text.next}` : undefined);
  } else if (access === "late")
    subtitle = "Yesterday — tap a prayer you made up to mark it qada";
  else if (access === "history")
    subtitle =
      "Unmarked prayers count as missed — tap one to recover it as qada";
  else subtitle = "Upcoming — mark them on the day";

  const chips: PrayerChip[] = children.map((c) => {
    const d = display(c);
    return {
      key: c.key,
      label: label(c),
      status: CHIP[prayerMark(c, date, today)],
      time: chipTime(c, times),
      now: d === "now",
      pending: d === "upcoming" || d === "unmarked" ? d : undefined,
    };
  });
  const unmarked = headline?.unmarked ?? 0;

  /** Today: one tap = prayed on time, whenever it's marked (people often mark later). Qada is an explicit choice. */
  const tap = (child: DayEntry) => {
    const m = prayerMark(child, date, today);
    if (m === "prayed" || m === "qada") return mark(child, "clear");
    if (access !== "live") return mark(child, tapMark);
    const d = display(child);
    const timing = times
      ? prayerTiming(prayerKeyOf(child.item) ?? "", now, times)
      : null;
    if (d === "upcoming") {
      notify({
        message:
          timing && times
            ? `${label(child)} starts at ${formatTime(clockIn(timing.start, times.timezone))}`
            : `${label(child)} hasn't started yet`,
      });
      return;
    }
    mark(child, "prayed");
    if (d === "unmarked")
      notify({
        message: `${label(child)} marked prayed`,
        action: { label: "Prayed late?", onClick: () => mark(child, "qada") },
      });
  };

  const needsLocation = isToday && settings.locationMode === "unset";
  /** "7:02 PM – 4:48 AM · best before 11:52 PM" for the check-in sheet. */
  const windowNote = (c: DayEntry): string | null => {
    if (!times || times.date !== date) return null;
    const timing = prayerTiming(prayerKeyOf(c.item) ?? "", now, times);
    if (!timing) return null;
    const f = (d: Date) => formatTime(clockIn(d, times.timezone));
    return `${f(timing.start)} – ${f(timing.end)}${timing.preferredEnd ? ` · best before ${f(timing.preferredEnd)}` : ""}`;
  };

  return (
    <>
      <PrayerRow
        title={entry.item.title}
        subtitle={subtitle}
        prayers={chips}
        onToggle={(key) => {
          const child = children.find((c) => c.key === key);
          if (!child || !markable) return;
          tap(child);
        }}
        onChipMore={(key, anchor) => {
          const child = children.find((c) => c.key === key);
          if (child && markable) setChipMenu({ child, anchor });
        }}
        onMore={() => setAllOpen(true)}
        footer={
          unmarked || needsLocation ? (
            <div className="space-y-1.5">
              {unmarked ? (
                <p className="flex items-center gap-2 text-[12px] text-ink-2">
                  <span className="flex-1">
                    {unmarked} {unmarked === 1 ? "prayer" : "prayers"} not
                    marked yet — prayed on time? Mark them now.
                  </span>
                  <button
                    type="button"
                    onClick={() => setAllOpen(true)}
                    className="min-h-7 rounded-full px-2 font-medium text-link hover:bg-track"
                  >
                    Mark prayers
                  </button>
                </p>
              ) : null}
              {needsLocation ? (
                <p className="flex items-center gap-2 text-[12px] text-ink-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="flex-1">
                    Times are approximate (Karachi).
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void ensure(
                        "whileUsing",
                        "Prayer times are calculated for where you are.",
                      )
                    }
                    className="min-h-7 rounded-full px-2 font-medium text-link hover:bg-track"
                  >
                    Set location
                  </button>
                </p>
              ) : null}
            </div>
          ) : undefined
        }
      />

      {chipMenu ? (
        <PopoverMenu
          anchor={chipMenu.anchor}
          onClose={() => setChipMenu(null)}
          label={label(chipMenu.child)}
        >
          {(
            [
              ["prayed", "Prayed on time", <Check key="i" />],
              ["qada", "Prayed late (qada)", <Clock4 key="i" />],
              ["missed", "Missed", <CircleSlash key="i" />],
            ] as const
          )
            .filter(([m]) => m !== "prayed" || offerOnTime)
            .map(([m, text, icon]) => (
              <PopoverMenuItem
                key={m}
                icon={icon}
                label={text}
                onClick={() => {
                  mark(chipMenu.child, m);
                  setChipMenu(null);
                }}
              />
            ))}
          <PopoverMenuDivider />
          <PopoverMenuItem
            icon={<Undo2 />}
            label="Clear"
            onClick={() => {
              mark(chipMenu.child, "clear");
              setChipMenu(null);
            }}
          />
        </PopoverMenu>
      ) : null}

      <Sheet
        open={allOpen}
        onClose={() => setAllOpen(false)}
        title={isToday ? "Mark today's prayers" : `Prayers · ${longDate(date)}`}
      >
        {offerOnTime &&
        children.some(
          (c) =>
            prayerMark(c, date, today) === "open" && display(c) !== "upcoming",
        ) ? (
          <button
            type="button"
            onClick={() => {
              for (const c of children)
                if (
                  prayerMark(c, date, today) === "open" &&
                  display(c) !== "upcoming"
                )
                  mark(c, "prayed");
            }}
            className="mb-3 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full bg-done px-3 text-[13px] font-medium text-on-fill"
          >
            <CheckCheck className="h-4 w-4" aria-hidden /> All on time
          </button>
        ) : null}
        <ul className="space-y-1.5" aria-label="Mark prayers">
          {children.map((c) => {
            const m = prayerMark(c, date, today);
            return (
              <li key={c.key} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">
                    {label(c)}
                  </span>
                  <span className="block text-[11.5px] text-ink-2">
                    {windowNote(c) ?? chipTime(c, times) ?? ""}
                  </span>
                </span>
                <span
                  role="group"
                  aria-label={`${label(c)} status`}
                  className="flex gap-1"
                >
                  {(
                    [
                      ["prayed", "On time"],
                      ["qada", "Qada"],
                      ["missed", "Missed"],
                    ] as const
                  )
                    .filter(
                      ([value]) =>
                        markable &&
                        display(c) !== "upcoming" &&
                        (value !== "prayed" || offerOnTime),
                    )
                    .map(([value, text]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={m === value}
                        onClick={() => mark(c, m === value ? "clear" : value)}
                        className={`min-h-8 rounded-full px-2.5 text-[12px] font-medium ${
                          m === value
                            ? value === "missed"
                              ? "bg-todo text-on-fill"
                              : value === "qada"
                                ? "bg-progress text-on-fill"
                                : "bg-done text-on-fill"
                            : "bg-track text-ink hover:bg-border"
                        }`}
                      >
                        {text}
                      </button>
                    ))}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex gap-1.5 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => {
              setAllOpen(false);
              router.push(`/items/view?id=${entry.item.id}`);
            }}
            className="flex min-h-9 items-center gap-1.5 rounded-full bg-track px-3 text-[12px] font-medium text-ink hover:bg-border"
          >
            <BarChart3 className="h-3.5 w-3.5" aria-hidden /> Insights
          </button>
          <button
            type="button"
            onClick={() => {
              setAllOpen(false);
              router.push("/settings/prayer");
            }}
            className="flex min-h-9 items-center gap-1.5 rounded-full bg-track px-3 text-[12px] font-medium text-ink hover:bg-border"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden /> Prayer settings
          </button>
        </div>
      </Sheet>
    </>
  );
}

/**
 * Yesterday's Isha after midnight: its time runs until Fajr, so it can still
 * be marked on time even though yesterday has locked (owner, 2026-10-12).
 */
export function IshaCarryOver({
  entry,
  date,
  times,
}: {
  entry: DayEntry;
  date: string;
  times: DayPrayerTimes;
}) {
  const run = useActions();
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const mark = (m: Parameters<typeof markPrayer>[2]) =>
    void run((ctx) => markPrayer(entry, date, m, ctx));
  const until = formatTime(clockIn(times.nextFajr, times.timezone));
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
    new Date(`${date}T12:00:00`),
  );
  return (
    <section
      aria-label={`${entry.item.title} from ${day}`}
      className="card flex items-center gap-3 px-3 py-2.5"
    >
      <Clock4 className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
      <p className="min-w-0 flex-1 text-[13px] text-ink">
        <span className="font-medium">
          {entry.item.title} ({day})
        </span>{" "}
        <span className="text-ink-2">· still on time until {until}</span>
      </p>
      <button
        type="button"
        onClick={() => mark("prayed")}
        className="min-h-8 rounded-full bg-done px-3 text-[12px] font-medium text-on-fill"
      >
        Prayed
      </button>
      <button
        type="button"
        aria-label={`More for ${entry.item.title} (${day})`}
        onClick={(e) => setMenu(e.currentTarget)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {menu ? (
        <PopoverMenu
          anchor={menu}
          onClose={() => setMenu(null)}
          label={`${entry.item.title} (${day})`}
        >
          <PopoverMenuItem
            icon={<Clock4 />}
            label="Prayed late (qada)"
            onClick={() => (mark("qada"), setMenu(null))}
          />
          <PopoverMenuItem
            icon={<CircleSlash />}
            label="Missed"
            onClick={() => (mark("missed"), setMenu(null))}
          />
        </PopoverMenu>
      ) : null}
    </section>
  );
}
