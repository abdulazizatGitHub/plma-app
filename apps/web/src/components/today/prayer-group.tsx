"use client";

import {
  anchorWindow,
  canLog,
  clockIn,
  dayAccess,
  currentPrayer,
  markPrayer,
  nextPrayer,
  normalisePrayerKey,
  prayerKeyOf,
  prayerMark,
  weekdayOf,
  type DayEntry,
  type DayPrayerTimes,
  type PrayerMark,
  type PrayerTimeKey,
} from "@life/shared";
import { BarChart3, Check, CircleSlash, Clock4, MapPin, Settings2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PopoverMenu, PopoverMenuDivider, PopoverMenuItem, PrayerRow, Sheet, type PrayerChip } from "@/components/kit";
import { useLocation } from "@/components/location/location-provider";
import { formatTime } from "@/lib/v2/category-style";
import { longDate } from "@/lib/v2/dates";
import { useActions, usePrayerTimes, useUserSettings } from "@/lib/v2/use-day";
import { useNow } from "@/lib/v2/use-now";
import { useToday } from "@/lib/v2/use-today";

const CHIP: Record<PrayerMark, PrayerChip["status"]> = { prayed: "done", qada: "qada", missed: "missed", open: "open" };
const TIME_KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
const NAMES: Record<string, string> = { fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Zuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };

const inMinutes = (from: Date, to: Date) => {
  const m = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

/** A prayer's time on this day: its calculated time, or its anchor's start (e.g. Tahajjud). */
function chipTime(child: DayEntry, times: DayPrayerTimes | null): string | undefined {
  if (!times) return undefined;
  const key = normalisePrayerKey(prayerKeyOf(child.item) ?? "");
  if (TIME_KEYS.includes(key)) return formatTime(times.clock[key as PrayerTimeKey]);
  const s = child.item.schedule;
  const w = s.kind !== "once" && s.anchor ? anchorWindow(s.anchor, times) : null;
  return w ? formatTime(clockIn(w.start, times.timezone)) : undefined;
}

/**
 * The prayer block (PRY-03/04, PRY-08/09, TOD-07): one tap per prayer, any
 * order; hold a chip (or ⋯) for prayed late (qada), missed or clear. Past
 * days show unmarked prayers as missed, ready to recover as qada.
 */
export function PrayerGroup({ entry, date }: { entry: DayEntry; date: string }) {
  const run = useActions();
  const router = useRouter();
  const settings = useUserSettings();
  const times = usePrayerTimes(date);
  const now = useNow();
  const { ensure } = useLocation();
  const [chipMenu, setChipMenu] = useState<{ child: DayEntry; anchor: HTMLElement } | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const today = useToday() ?? date;
  const isToday = date === today;
  const children = entry.children ?? [];
  const friday = weekdayOf(date) === 5 && settings.jumuahLabel;
  const label = (c: DayEntry) => (friday && prayerKeyOf(c.item) === "dhuhr" ? "Jumu'ah" : c.item.title);
  const current = isToday && times ? currentPrayer(now, times) : null;
  const mark = (child: DayEntry, m: Parameters<typeof markPrayer>[2]) => void run((ctx) => markPrayer(child, date, m, ctx));
  // Today: one tap = prayed. Past days: one tap = qada (made up later). Future: can't mark yet.
  const access = dayAccess(date, today);
  const markable = access !== "planned";
  const tapMark = access === "live" ? "prayed" : "qada";
  // "On time" stays available for yesterday (prayed but forgot to tap); older days only qada / missed.
  const offerOnTime = canLog(access);

  const nameOf = (key: string) => {
    const child = children.find((c) => normalisePrayerKey(prayerKeyOf(c.item) ?? "") === key);
    return child ? label(child) : (NAMES[key] ?? key);
  };
  let subtitle: string | undefined;
  if (isToday && times) {
    const next = nextPrayer(now, times);
    subtitle = current
      ? `${nameOf(current.key)} now · until ${formatTime(clockIn(current.window.end, times.timezone))}`
      : `${nameOf(next.key)} in ${inMinutes(now, next.at)}`;
  } else if (access === "late") subtitle = "Yesterday — tap a prayer you made up to mark it qada";
  else if (access === "history") subtitle = "Unmarked prayers count as missed — tap one to recover it as qada";
  else subtitle = "Upcoming — mark them on the day";

  const chips: PrayerChip[] = children.map((c) => ({
    key: c.key,
    label: label(c),
    status: CHIP[prayerMark(c, date, today)],
    time: chipTime(c, times),
    now: current !== null && normalisePrayerKey(prayerKeyOf(c.item) ?? "") === current.key,
  }));

  const needsLocation = isToday && settings.locationMode === "unset";

  return (
    <>
      <PrayerRow
        title={entry.item.title}
        subtitle={subtitle}
        prayers={chips}
        onToggle={(key) => {
          const child = children.find((c) => c.key === key);
          if (!child || !markable) return;
          const m = prayerMark(child, date, today);
          mark(child, m === "prayed" || m === "qada" ? "clear" : tapMark);
        }}
        onChipMore={(key, anchor) => {
          const child = children.find((c) => c.key === key);
          if (child && markable) setChipMenu({ child, anchor });
        }}
        onMore={() => setAllOpen(true)}
        footer={
          needsLocation ? (
            <p className="flex items-center gap-2 text-[12px] text-ink-2">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="flex-1">Times are approximate (Karachi).</span>
              <button
                type="button"
                onClick={() => void ensure("whileUsing", "Prayer times are calculated for where you are.")}
                className="min-h-7 rounded-full px-2 font-medium text-link hover:bg-track"
              >
                Set location
              </button>
            </p>
          ) : undefined
        }
      />

      {chipMenu ? (
        <PopoverMenu anchor={chipMenu.anchor} onClose={() => setChipMenu(null)} label={label(chipMenu.child)}>
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

      <Sheet open={allOpen} onClose={() => setAllOpen(false)} title={`Prayers · ${longDate(date)}`}>
        <ul className="space-y-1.5" aria-label="Mark prayers">
          {children.map((c) => {
            const m = prayerMark(c, date, today);
            return (
              <li key={c.key} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">{label(c)}</span>
                  <span className="block text-[11.5px] text-ink-2">{chipTime(c, times) ?? ""}</span>
                </span>
                <span role="group" aria-label={`${label(c)} status`} className="flex gap-1">
                  {(
                    [
                      ["prayed", "On time"],
                      ["qada", "Qada"],
                      ["missed", "Missed"],
                    ] as const
                  )
                    .filter(([value]) => markable && (value !== "prayed" || offerOnTime))
                    .map(([value, text]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={m === value}
                      onClick={() => mark(c, m === value ? "clear" : value)}
                      className={`min-h-8 rounded-full px-2.5 text-[12px] font-medium ${
                        m === value ? (value === "missed" ? "bg-todo text-on-fill" : value === "qada" ? "bg-progress text-on-fill" : "bg-done text-on-fill") : "bg-track text-ink hover:bg-border"
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
