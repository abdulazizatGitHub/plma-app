"use client";

import { LocateFixed, MapPin, Search, Smartphone } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Sheet } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { useStore } from "@/components/providers/store-provider";
import {
  LOCATION_CHECKED_KEY,
  LOCATION_LEVEL_KEY,
  LocationError,
  MOVE_KM,
  REFRESH_MS,
  browserPermission,
  currentPosition,
  decideLocation,
  deviceTimezone,
  type LocationLevel,
} from "@/lib/location/access";
import { distanceKm, labelFor, searchCities, type City } from "@/lib/location/cities";
import { useSaveSettings, useUserSettings } from "@/lib/v2/use-day";

type Ask = { reason: string; required: LocationLevel; done: () => void };
type Panel = { kind: "ask" | "city" | "upgrade" | "denied"; ask: Ask } | null;

type LocationApi = {
  /**
   * A feature needs location at `required`. Asks only when needed (see
   * access.ts); resolves once the user has answered or nothing was needed.
   * `force` is for explicit taps like "Use my location", which may re-ask.
   */
  ensure: (required: LocationLevel, reason: string, opts?: { force?: boolean }) => Promise<void>;
  chooseCity: () => Promise<void>;
};

const LocationContext = createContext<LocationApi | null>(null);

/** Outside the app shell (tests, the UI kit page) location is simply unavailable. */
const INERT: LocationApi = { ensure: () => Promise.resolve(), chooseCity: () => Promise.resolve() };

export function useLocation(): LocationApi {
  return useContext(LocationContext) ?? INERT;
}

function CityPicker({ onPick }: { onPick: (city: City) => void }) {
  const [q, setQ] = useState("");
  const results = searchCities(q, 10);
  return (
    <div className="space-y-2">
      <label className="relative block">
        <span className="sr-only">Search cities</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-2" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a city, e.g. Lahore"
          className="h-10 w-full rounded-[12px] border border-border bg-surface pr-3 pl-9 text-[14px] text-ink outline-none focus:border-primary-strong"
        />
      </label>
      <ul className="max-h-72 space-y-0.5 overflow-y-auto" aria-label="Cities">
        {results.map((c) => (
          <li key={`${c.name}-${c.country}`}>
            <button type="button" onClick={() => onPick(c)} className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 text-left text-[14px] text-ink hover:bg-track">
              <MapPin className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
              <span className="flex-1">{c.name}</span>
              <span className="text-[12px] text-ink-2">{c.country}</span>
            </button>
          </li>
        ))}
        {!results.length ? <li className="px-2 py-3 text-[13px] text-ink-2">No match. Try a nearby larger city.</li> : null}
      </ul>
    </div>
  );
}

/** Hosts the location sheets and the "you've moved" banner for every feature. */
export function LocationProvider({ children }: { children: ReactNode }) {
  const settings = useUserSettings();
  const { store } = useStore();
  const { notify } = useAddSheet();
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [moved, setMoved] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const save = useSaveSettings();

  const takeDevicePosition = useCallback(
    async (ask: Ask) => {
      setBusy(true);
      try {
        const p = await currentPosition();
        // The grant is known now; record it before the settings write lands.
        store?.setMeta(LOCATION_LEVEL_KEY, "whileUsing");
        store?.setMeta(LOCATION_CHECKED_KEY, String(Date.now()));
        await save({ lat: p.lat, lng: p.lng, locationLabel: labelFor(p), timezone: deviceTimezone(), locationMode: "device" });
        notify({ message: `Prayer times set for ${labelFor(p)}` });
        setPanel(null);
        ask.done();
      } catch (e) {
        // Blocked in the browser (or no fix): offer a city instead.
        setPanel({ kind: e instanceof LocationError && e.reason === "denied" ? "denied" : "city", ask });
      } finally {
        setBusy(false);
      }
    },
    [save, store, notify],
  );

  const pickCity = useCallback(
    async (city: City, ask: Ask) => {
      await save({ lat: city.lat, lng: city.lng, locationLabel: city.name, timezone: city.timezone, locationMode: "city" });
      notify({ message: `Prayer times set for ${city.name}` });
      setPanel(null);
      ask.done();
    },
    [save, notify],
  );

  const ensure = useCallback<LocationApi["ensure"]>(
    async (required, reason, opts) => {
      const s = settingsRef.current;
      const permission = await browserPermission();
      const level = (store?.getMeta(LOCATION_LEVEL_KEY) as LocationLevel | null) ?? null;
      const decision = opts?.force && required !== "never" ? (permission === "granted" && s.locationMode === "device" ? "use" : "ask") : decideLocation(required, { mode: s.locationMode, permission, level });
      if (decision === "fallback") return;
      await new Promise<void>((done) => {
        const ask = { reason, required, done };
        if (decision === "use") void takeDevicePosition(ask);
        else setPanel({ kind: decision === "upgrade" ? "upgrade" : "ask", ask });
      });
    },
    [store, takeDevicePosition],
  );

  const chooseCity = useCallback(() => new Promise<void>((done) => setPanel({ kind: "city", ask: { reason: "", required: "never", done } })), []);

  // While in use: refresh the fix now and then, and offer to follow a move (never silently).
  useEffect(() => {
    if (!store || settings.locationMode !== "device" || settings.lat === null || settings.lng === null) return;
    const last = Number(store.getMeta(LOCATION_CHECKED_KEY) ?? 0);
    if (Date.now() - last < REFRESH_MS) return;
    const saved = { lat: settings.lat, lng: settings.lng };
    void (async () => {
      if ((await browserPermission()) !== "granted") return;
      try {
        const p = await currentPosition();
        store.setMeta(LOCATION_CHECKED_KEY, String(Date.now()));
        if (distanceKm(saved, p) > MOVE_KM) setMoved({ ...p, label: labelFor(p) });
      } catch {
        // No fix right now; try again next time.
      }
    })();
  }, [store, settings.locationMode, settings.lat, settings.lng]);

  const api = useMemo<LocationApi>(() => ({ ensure, chooseCity }), [ensure, chooseCity]);
  const close = () => {
    panel?.ask.done();
    setPanel(null);
  };

  return (
    <LocationContext.Provider value={api}>
      {children}
      {moved ? (
        <div role="status" className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.25rem)] z-40 flex justify-center px-4 lg:pl-60">
          <div className="card flex w-full max-w-xl items-center gap-2 p-2.5 pl-3.5 shadow-[0_8px_24px_rgb(27_26_34/14%)]">
            <LocateFixed className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
            <p className="min-w-0 flex-1 text-[13px] text-ink">
              You seem to be in <b>{moved.label}</b>. Update prayer times?
            </p>
            <Button size="sm" onClick={() => void save({ lat: moved.lat, lng: moved.lng, locationLabel: moved.label, timezone: deviceTimezone() }).then(() => setMoved(null))}>
              Update
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMoved(null)}>
              Not now
            </Button>
          </div>
        </div>
      ) : null}
      <Sheet
        open={panel !== null}
        onClose={close}
        title={panel?.kind === "city" ? "Choose your city" : panel?.kind === "upgrade" ? "Allow location all the time?" : panel?.kind === "denied" ? "Location is blocked" : "Use your location?"}
      >
        {panel?.kind === "ask" ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-2">{panel.ask.reason} It&apos;s rounded to about 1 km and only used for this.</p>
            <div className="space-y-1.5">
              <button
                type="button"
                disabled
                className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border px-3 text-left text-[13px] text-ink-2"
                aria-describedby="always-note"
              >
                <Smartphone className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">
                  Always <span id="always-note" className="block text-[11.5px]">Needs the Life phone app (coming later)</span>
                </span>
              </button>
              <Button size="lg" className="w-full" disabled={busy} onClick={() => void takeDevicePosition(panel.ask)}>
                <LocateFixed className="h-4 w-4" aria-hidden /> {busy ? "Finding you…" : "While using the app"}
              </Button>
              <Button size="lg" variant="secondary" className="w-full" onClick={() => setPanel({ kind: "city", ask: panel.ask })}>
                <MapPin className="h-4 w-4" aria-hidden /> Choose a city instead
              </Button>
              <button
                type="button"
                onClick={() => {
                  void save({ locationMode: "never" });
                  close();
                }}
                className="min-h-9 w-full text-[12px] font-medium text-ink-2 hover:text-ink"
              >
                Never — keep Karachi times
              </button>
            </div>
          </div>
        ) : panel?.kind === "upgrade" ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-2">{panel.ask.reason} This needs location even when the app is closed, which the web app can&apos;t do. It will work in the Life phone app.</p>
            <Button size="lg" className="w-full" onClick={close}>
              OK
            </Button>
          </div>
        ) : panel?.kind === "denied" ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-2">Your browser blocks location for this site. Allow it in the site settings (the icon left of the address), or choose your city.</p>
            <CityPicker onPick={(c) => void pickCity(c, panel.ask)} />
          </div>
        ) : panel?.kind === "city" ? (
          <CityPicker onPick={(c) => void pickCity(c, panel.ask)} />
        ) : null}
      </Sheet>
    </LocationContext.Provider>
  );
}
