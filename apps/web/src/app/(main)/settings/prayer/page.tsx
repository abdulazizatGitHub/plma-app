"use client";

import {
  EXTRA_PRAYERS,
  PRAYER_METHODS,
  PRAYER_TIME_ORDER,
  STARTER_PACKS,
  createPrayerSet,
  savePrayerSet,
  type PrayerTimeKey,
} from "@life/shared";
import { ArrowLeft, LocateFixed, MapPin, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button, Checkbox, Pill, SegmentedTabs } from "@/components/kit";
import { ListEditor, newRow, type ListRow } from "@/components/items/list-editor";
import { useLocation } from "@/components/location/location-provider";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { formatTime } from "@/lib/v2/category-style";
import { useActions, useAllCategories, useAllItems, usePrayerSet, usePrayerTimes, useSaveSettings, useUserSettings } from "@/lib/v2/use-day";
import { useToday } from "@/lib/v2/use-today";

const LABEL: Record<PrayerTimeKey, string> = { fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Zuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
const ADJUSTABLE = PRAYER_TIME_ORDER.filter((k) => k !== "sunrise");
const SPIRITUAL = STARTER_PACKS[0].id;

function Card({ title, children, hint }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="card space-y-3 p-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {hint ? <p className="mt-0.5 text-[12px] text-ink-2">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Prayer times, location and the prayer list (PRY-01, PRY-05, PRY-10). */
export default function PrayerSettingsPage() {
  const settings = useUserSettings();
  const run = useActions();
  const router = useRouter();
  const { notify } = useAddSheet();
  const { ensure, chooseCity } = useLocation();
  const { group, prayers } = usePrayerSet();
  const { items } = useAllItems();
  const categories = useAllCategories();
  const today = useToday();
  const times = usePrayerTimes(today);
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const prayerRows = rows ?? prayers.map((p) => newRow(p.title, p.id));
  const save = useSaveSettings();

  const where =
    settings.locationMode === "device"
      ? `From your device · ${settings.locationLabel ?? "your location"}`
      : settings.locationMode === "city" && settings.locationLabel
        ? `${settings.locationLabel} (chosen city)`
        : "Approximate — Karachi until you set a location";

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => router.push("/profile")} className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Profile
      </button>
      <h1 className="text-xl font-semibold text-ink">Prayer settings</h1>

      <Card title="Location" hint="Prayer times are calculated on your phone for this place — no internet needed.">
        <p className="flex items-center gap-2 text-[13px] text-ink">
          <MapPin className="h-4 w-4 text-ink-2" aria-hidden /> {where}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => void ensure("whileUsing", "Prayer times are calculated for where you are.", { force: true })}>
            <LocateFixed className="h-3.5 w-3.5" aria-hidden /> Use my location
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void chooseCity()}>
            <MapPin className="h-3.5 w-3.5" aria-hidden /> Choose a city
          </Button>
        </div>
      </Card>

      {times ? (
        <Card title="Today's times" hint={times.approximate ? "Approximate (Karachi)." : `In ${settings.timezone.replace("_", " ")}.`}>
          <ul className="grid grid-cols-3 gap-2" aria-label="Today's prayer times">
            {PRAYER_TIME_ORDER.map((k) => (
              <li key={k} className="rounded-xl bg-track px-2.5 py-2">
                <span className="block text-[11px] text-ink-2">{LABEL[k]}</span>
                <span className="block text-[14px] font-semibold text-ink">{formatTime(times.clock[k])}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Calculation">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Method</span>
          <select
            value={settings.calcMethod}
            onChange={(e) => void save({ calcMethod: e.target.value })}
            className="h-10 w-full rounded-[12px] border border-border bg-surface px-3 text-[14px] text-ink outline-none focus:border-primary-strong"
          >
            {Object.entries(PRAYER_METHODS).map(([key, m]) => (
              <option key={key} value={key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="mb-1 block text-[12px] font-medium text-ink">Asr</span>
          <SegmentedTabs
            label="Asr calculation"
            value={settings.madhab}
            onChange={(madhab) => void save({ madhab })}
            options={[
              { value: "hanafi", label: "Hanafi (later)" },
              { value: "shafi", label: "Shafi'i / others" },
            ]}
          />
        </div>
        <Checkbox checked={settings.jumuahLabel} onChange={(jumuahLabel) => void save({ jumuahLabel })}>
          Show Zuhr as Jumu&apos;ah on Fridays
        </Checkbox>
      </Card>

      <Card title="Match your mosque" hint="Nudge a time by a few minutes, or set a fixed time. Empty = calculated.">
        <ul className="space-y-1.5">
          {ADJUSTABLE.map((k) => {
            const off = settings.prayerOffsets[k] ?? 0;
            const manual = settings.prayerManual[k] ?? "";
            return (
              <li key={k} className="flex items-center gap-2">
                <span className="w-16 text-[13px] font-medium text-ink">{LABEL[k]}</span>
                <span className="w-16 text-[12px] text-ink-2">{times ? formatTime(times.clock[k]) : ""}</span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`${LABEL[k]} one minute earlier`}
                    disabled={off <= -30 || Boolean(manual)}
                    onClick={() => void save((s) => ({ prayerOffsets: { ...s.prayerOffsets, [k]: Math.max(-30, (s.prayerOffsets[k] ?? 0) - 1) } }))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-track text-ink disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <span className="w-9 text-center text-[12px] text-ink" aria-label={`${LABEL[k]} adjustment`}>
                    {off > 0 ? `+${off}` : off}m
                  </span>
                  <button
                    type="button"
                    aria-label={`${LABEL[k]} one minute later`}
                    disabled={off >= 30 || Boolean(manual)}
                    onClick={() => void save((s) => ({ prayerOffsets: { ...s.prayerOffsets, [k]: Math.min(30, (s.prayerOffsets[k] ?? 0) + 1) } }))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-track text-ink disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
                <input
                  type="time"
                  aria-label={`${LABEL[k]} fixed time`}
                  value={manual}
                  onChange={(e) => {
                    const value = e.target.value;
                    void save((s) => {
                      const next = { ...s.prayerManual };
                      if (value) next[k] = value;
                      else delete next[k];
                      return { prayerManual: next };
                    });
                  }}
                  className="ml-auto h-8 w-28 min-w-0 rounded-[10px] border border-border bg-surface px-1.5 text-[12px] text-ink"
                />
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Your prayers" hint="Rename, reorder, add or remove. History follows each prayer.">
        {group ? (
          <>
            <ListEditor
              legend="Prayer"
              rows={prayerRows}
              onChange={setRows}
              max={12}
              maxLength={40}
              placeholder="e.g. Ishraq"
              addLabel="Add a prayer"
            />
            <div className="flex flex-wrap gap-1.5">
              {EXTRA_PRAYERS.filter((x) => !prayerRows.some((r) => r.title.trim().toLowerCase() === x.title.toLowerCase())).map((x) => (
                <Pill key={x.key} selected={false} onClick={() => setRows([...prayerRows, newRow(x.title)])}>
                  <Plus className="h-3 w-3" aria-hidden /> {x.title}
                </Pill>
              ))}
            </div>
            <Button
              disabled={rows === null || !prayerRows.some((r) => r.title.trim())}
              onClick={() => {
                const g = group;
                void run((ctx) => savePrayerSet(g, items, prayerRows.map((r) => ({ id: r.id, title: r.title })), ctx, () => crypto.randomUUID()));
                setRows(null);
                notify({ message: "Prayers saved" });
              }}
            >
              Save prayers
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-[13px] text-ink-2">You don&apos;t have a prayer block yet.</p>
            <Button
              onClick={() => {
                const spiritual = categories.find((c) => c.sourceTemplateId === SPIRITUAL && !c.archivedAt) ?? categories.find((c) => c.name.toLowerCase() === "spiritual" && !c.archivedAt);
                void run((ctx) => createPrayerSet(ctx, () => crypto.randomUUID(), { categoryId: spiritual?.id ?? null })).then(() =>
                  ensure("whileUsing", "Prayer times are calculated for where you are."),
                );
                notify({ message: "Added Daily prayers to Today" });
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> Add daily prayers
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
