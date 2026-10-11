import { CalculationMethod, Coordinates, Madhab, PrayerTimes, type CalculationParameters } from "adhan";
import type { UserSettings } from "../entities.js";

/*
 * Prayer times on the device (PRY-05, PRY-10, docs/guides/PRAYER_TIMES.md).
 * adhan-js computes them from the sun's position; nothing goes over the
 * network, so they work offline. Defaults: Karachi method, Hanafi Asr.
 */

export const PRAYER_TIME_ORDER = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerTimeKey = (typeof PRAYER_TIME_ORDER)[number];

/** Methods offered in Prayer settings → adhan's parameter factories. */
export const PRAYER_METHODS: Record<string, { label: string; params: () => CalculationParameters }> = {
  karachi: { label: "Karachi (University of Islamic Sciences)", params: () => CalculationMethod.Karachi() },
  mwl: { label: "Muslim World League", params: () => CalculationMethod.MuslimWorldLeague() },
  isna: { label: "ISNA (North America)", params: () => CalculationMethod.NorthAmerica() },
  egypt: { label: "Egyptian General Authority", params: () => CalculationMethod.Egyptian() },
  ummAlQura: { label: "Umm al-Qura (Makkah)", params: () => CalculationMethod.UmmAlQura() },
  dubai: { label: "Dubai", params: () => CalculationMethod.Dubai() },
  qatar: { label: "Qatar", params: () => CalculationMethod.Qatar() },
  kuwait: { label: "Kuwait", params: () => CalculationMethod.Kuwait() },
  singapore: { label: "Singapore", params: () => CalculationMethod.Singapore() },
  turkey: { label: "Turkey (Diyanet)", params: () => CalculationMethod.Turkey() },
  tehran: { label: "Tehran", params: () => CalculationMethod.Tehran() },
  moonsighting: { label: "Moonsighting Committee", params: () => CalculationMethod.MoonsightingCommittee() },
};

/** Used until the user shares a location or picks a city (then times are "approximate"). */
export const DEFAULT_LOCATION = { lat: 24.86, lng: 67.01, label: "Karachi", timezone: "Asia/Karachi" } as const;

export type PrayerSettings = Pick<UserSettings, "lat" | "lng" | "timezone" | "calcMethod" | "madhab" | "prayerOffsets"> & {
  prayerManual?: Record<string, string> | null;
};

export type DayPrayerTimes = {
  date: string;
  timezone: string;
  /** No saved location: computed for Karachi. */
  approximate: boolean;
  /** Instants. */
  at: Record<PrayerTimeKey, Date>;
  /** Local clock in `timezone`, "HH:mm". */
  clock: Record<PrayerTimeKey, string>;
  /** Next day's Fajr: the end of Isha's window and of the night. */
  nextFajr: Date;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** "HH:mm" of an instant in an IANA time zone. */
export function clockIn(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

/** The instant of a local wall-clock time ("HH:mm" on `date`) in `timezone`. */
export function zonedInstant(date: string, hhmm: string, timezone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  // Read the guess back in the zone; the difference is the zone's offset then.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const seen = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (seen - guess));
}

function addDay(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

function compute(date: string, s: PrayerSettings): Record<PrayerTimeKey, Date> {
  const params = (PRAYER_METHODS[s.calcMethod] ?? PRAYER_METHODS.karachi).params();
  params.madhab = s.madhab === "shafi" ? Madhab.Shafi : Madhab.Hanafi;
  const off = (k: string) => Math.max(-30, Math.min(30, Math.round(s.prayerOffsets?.[k] ?? 0)));
  params.adjustments = { fajr: off("fajr"), sunrise: off("sunrise"), dhuhr: off("dhuhr"), asr: off("asr"), maghrib: off("maghrib"), isha: off("isha") };
  const lat = s.lat ?? DEFAULT_LOCATION.lat;
  const lng = s.lng ?? DEFAULT_LOCATION.lng;
  const [y, m, d] = date.split("-").map(Number);
  // adhan reads the calendar date from the Date's local fields.
  const t = new PrayerTimes(new Coordinates(lat, lng), new Date(y, m - 1, d), params);
  const at: Record<PrayerTimeKey, Date> = { fajr: t.fajr, sunrise: t.sunrise, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha };
  for (const key of PRAYER_TIME_ORDER) {
    const manual = s.prayerManual?.[key];
    if (manual && /^([01]\d|2[0-3]):[0-5]\d$/.test(manual)) at[key] = zonedInstant(date, manual, s.timezone);
  }
  return at;
}

/** The day's prayer times for the user's location and settings. */
export function prayerTimes(date: string, s: PrayerSettings): DayPrayerTimes {
  const at = compute(date, s);
  const clock = Object.fromEntries(PRAYER_TIME_ORDER.map((k) => [k, clockIn(at[k], s.timezone)])) as Record<PrayerTimeKey, string>;
  return { date, timezone: s.timezone, approximate: s.lat === null || s.lng === null, at, clock, nextFajr: compute(addDay(date, 1), s).fajr };
}
