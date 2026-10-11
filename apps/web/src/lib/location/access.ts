import type { UserSettings } from "@life/shared";

/*
 * Location access, asked just in time (owner, 2026-10-11):
 *  - a feature declares the level it needs: never < while using < always
 *  - if what's granted already covers it, never ask again
 *  - ask only when a feature needs more than what's granted (e.g. it needs
 *    Always but only While using was given)
 *  - "Never" (or a picked city) is respected: no automatic prompts
 * A PWA can only get While-using access; Always needs the native app
 * (Phase 11), so on the web an Always request explains that instead.
 */

export type LocationLevel = "never" | "whileUsing" | "always";
export type BrowserPermission = "granted" | "prompt" | "denied" | "unsupported";

const RANK: Record<LocationLevel, number> = { never: 0, whileUsing: 1, always: 2 };
export const covers = (granted: LocationLevel, required: LocationLevel) => RANK[granted] >= RANK[required];

/** What to do when a feature needs location. */
export type LocationDecision =
  /** Granted at a sufficient level: read the position silently. */
  | "use"
  /** Never asked (or permission reset in the browser): show the pre-prompt sheet. */
  | "ask"
  /** Granted, but below what this feature needs: ask to upgrade. */
  | "upgrade"
  /** The user chose a city or Never, or the browser blocks it: use the saved place, don't prompt. */
  | "fallback";

export function decideLocation(
  required: LocationLevel,
  state: { mode: UserSettings["locationMode"]; permission: BrowserPermission; level: LocationLevel | null },
): LocationDecision {
  if (required === "never") return "fallback";
  if (state.mode === "never" || state.mode === "city") return "fallback";
  if (state.permission === "unsupported" || state.permission === "denied") return state.mode === "unset" ? "ask" : "fallback";
  if (state.mode === "unset" || state.permission === "prompt") return "ask";
  return covers(state.level ?? "whileUsing", required) ? "use" : "upgrade";
}

export async function browserPermission(): Promise<BrowserPermission> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "unsupported";
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    return (status?.state as BrowserPermission | undefined) ?? "prompt";
  } catch {
    return "prompt";
  }
}

export class LocationError extends Error {
  constructor(readonly reason: "denied" | "unavailable" | "timeout" | "unsupported") {
    super(reason);
  }
}

/** One position fix (the browser shows its own prompt the first time). */
export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new LocationError("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new LocationError(e.code === e.PERMISSION_DENIED ? "denied" : e.code === e.TIMEOUT ? "timeout" : "unavailable")),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
    );
  });
}

/** The device's IANA time zone (prayer times are shown in it). */
export const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Karachi";

/** Local meta keys. */
export const LOCATION_LEVEL_KEY = "location_level";
export const LOCATION_CHECKED_KEY = "location_checked_at";
/** A silent refresh at most this often while the app is in use. */
export const REFRESH_MS = 6 * 60 * 60_000;
/** Moving further than this offers to update the prayer location. */
export const MOVE_KM = 25;
