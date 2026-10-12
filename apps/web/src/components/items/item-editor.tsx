"use client";

import { createItem, normalisePrayerKey, prayerKeyOf, saveChildren, todayLocalDate, updateItem, type Change, type Item } from "@life/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { DisabledHint } from "@/components/auth/auth-shell";
import { Button, Checkbox, ChipChoice, DateField, NumberStepper, Pill, PillGroup, SegmentedTabs, StickyActions, TextField, TimeField } from "@/components/kit";
import { categoryTone } from "@/lib/v2/category-style";
import { useLocation } from "@/components/location/location-provider";
import { useActions, useAllCategories, useCategories, useItemReminders, useNextSortOrder, usePrayerSet, useUserSettings } from "@/lib/v2/use-day";
import { useToday } from "@/lib/v2/use-today";
import { firstError, initialState, isOnce, toDraft, validate, type EditorPreset, type EditorState } from "./editor-state";
import { ListEditor } from "./list-editor";
import { ReminderSection, initialReminderState, reminderChanges, reminderErrors, type ReminderEditorState } from "@/components/reminders/reminder-section";

const KINDS = [
  { value: "task", label: "Task · once" },
  { value: "habit", label: "Habit · repeats" },
  { value: "group", label: "Routine · sub-items" },
] as const;
const TRACKS = [
  { value: "check", label: "Tick" },
  { value: "quantity", label: "Count" },
  { value: "duration", label: "Time" },
  { value: "checklist", label: "Checklist" },
] as const;
const REPEATS = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Some days" },
  { value: "everyNDays", label: "Every N days" },
  { value: "monthly", label: "Monthly" },
] as const;
const WHEN = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "pick", label: "Pick date" },
  { value: "none", label: "No date" },
] as const;
const TIME_OF_DAY = [
  { value: "any", label: "Any time" },
  { value: "time", label: "At a time" },
  { value: "prayer", label: "Around a prayer" },
] as const;
const RELATIONS = [
  { value: "before", label: "Before" },
  { value: "at", label: "At" },
  { value: "after", label: "After" },
] as const;
const OFFSETS = [0, 5, 10, 15, 30, 45, 60];
const DEFAULT_PRAYER_OPTIONS = [
  { key: "fajr", title: "Fajr" },
  { key: "sunrise", title: "Sunrise" },
  { key: "dhuhr", title: "Zuhr" },
  { key: "asr", title: "Asr" },
  { key: "maghrib", title: "Maghrib" },
  { key: "isha", title: "Isha" },
];

const PRIORITY = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;
/** Monday-first; values are JS weekdays (0 = Sunday). */
const WEEK = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="card space-y-3 p-3.5">
      <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

type ItemEditorProps = {
  item: Item | null;
  /** The routine's sub-items when editing one. */
  existingChildren: Item[];
  preset: EditorPreset;
  onSaved: (item: Item, created: boolean) => void;
  onCancel: () => void;
};

/** The full editor ("More options"): kind, tracking, schedule, importance, sub-items (Phase 3). */
export function ItemEditor({ item, existingChildren, preset, onSaved, onCancel }: ItemEditorProps) {
  const today = useToday() ?? todayLocalDate();
  const categories = useCategories();
  const run = useActions();
  const nextSortOrder = useNextSortOrder();
  const { prayers } = usePrayerSet();
  const settings = useUserSettings();
  const { ensure } = useLocation();
  // The user's own prayers (renamed ones keep their key), plus Sunrise.
  const prayerOptions = prayers.length
    ? [
        ...prayers.flatMap((p) => {
          const key = prayerKeyOf(p);
          return key ? [{ key: normalisePrayerKey(key), title: p.title }] : [];
        }),
        { key: "sunrise", title: "Sunrise" },
      ]
    : DEFAULT_PRAYER_OPTIONS;
  const [s, setState] = useState<EditorState>(() => initialState(item, existingChildren, preset, today));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const reminderRows = useItemReminders(item?.id);
  const allCategories = useAllCategories();
  const [reminderStart] = useState<ReminderEditorState>(() => initialReminderState(reminderRows, settings, item?.priority ?? "medium"));
  const [reminder, setReminder] = useState<ReminderEditorState>(reminderStart);
  const errors = validate(s);
  const reminderError = reminderErrors(reminder);
  const valid = Object.keys(errors).length === 0 && !reminderError;
  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) => setState((prev) => ({ ...prev, [key]: value }));
  const touch = (key: string) => () => setTouched((t) => new Set(t).add(key));
  const shown = (key: keyof typeof errors) => (touched.has(key) ? (errors[key] ?? null) : null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid) return;
    const { draft, children } = toDraft(s, today);
    let saved: Item | null = null;
    void run((ctx) => {
      const newId = () => crypto.randomUUID();
      let changes: Change[];
      if (item) {
        changes = updateItem(item, draft, existingChildren, ctx);
        saved = changes[0].row as Item;
        // Sub-items as updateItem left them (new schedule/category), so saveChildren builds on those.
        const updated = new Map(changes.slice(1).map((c) => [c.row.id, c.row as Item]));
        const kids = existingChildren.map((c) => updated.get(c.id) ?? c);
        const childChanges = saveChildren(saved, kids, children, ctx, newId);
        const touchedIds = new Set(childChanges.map((c) => c.row.id));
        changes = [...changes.filter((c) => !touchedIds.has(c.row.id)), ...childChanges];
      } else {
        changes = createItem(newId(), { ...draft, parentId: null }, nextSortOrder(), ctx);
        saved = changes[0].row as Item;
        changes.push(...saveChildren(saved, [], children, ctx, newId));
      }
      return [...changes, ...reminderChanges(saved.id, reminderRows, reminder, reminderStart, ctx)];
    }).then(() => {
      if (saved) onSaved(saved, !item);
      // Prayer anchors use prayer times: ask for location now if it was never set (just in time).
      if (!once && s.timeOfDay === "prayer" && settings.locationMode === "unset") void ensure("whileUsing", "This item follows prayer times, which are calculated for where you are.");
    });
  }

  const once = isOnce(s);
  return (
    <form noValidate onSubmit={submit} className="space-y-3">
      <Section title="What">
        <TextField
          label="Name"
          placeholder={s.kind === "group" ? "e.g. Gym — Push day" : s.kind === "habit" ? "e.g. Steps" : "e.g. Quiz — Data Structures"}
          required
          maxLength={200}
          value={s.title}
          onChange={(e) => set("title", e.target.value)}
          onBlur={touch("title")}
          error={shown("title")}
        />
        <PillGroup legend="Kind" options={KINDS} value={s.kind} onChange={(v) => set("kind", v)} />
        <fieldset>
          <legend className="mb-1 text-[12px] font-medium text-ink">Category</legend>
          <div className="flex flex-wrap gap-1.5">
            {[{ id: null, name: "None", color: "" }, ...categories].map((c) => (
              <Pill key={c.id ?? "none"} selected={s.categoryId === c.id} onClick={() => set("categoryId", c.id)}>
                {c.id ? <span aria-hidden className="h-2.5 w-2.5 rounded-full ring-1 ring-ink/25" style={{ background: `var(--cat-${categoryTone(c)})` }} /> : null}
                {c.name}
              </Pill>
            ))}
          </div>
        </fieldset>
      </Section>

      {s.kind === "group" ? (
        <Section title="Sub-items">
          <p className="-mt-1 text-[12px] text-ink-2">Tick them one by one; the routine is done when all are.</p>
          <ListEditor
            legend="Sub-item"
            rows={s.children}
            onChange={(rows) => {
              set("children", rows);
              setTouched((t) => new Set(t).add("children"));
            }}
            max={30}
            maxLength={200}
            placeholder="e.g. Bench press"
            addLabel="Add sub-item"
            error={shown("children")}
          />
        </Section>
      ) : (
        <Section title="Track it as">
          <SegmentedTabs label="Track it as" options={[...TRACKS]} value={s.track} onChange={(v) => set("track", v)} />
          {s.track === "quantity" ? (
            <div>
              <TextField label="Unit" placeholder="steps" required maxLength={24} value={s.unit} onChange={(e) => set("unit", e.target.value)} onBlur={touch("unit")} error={shown("unit")} />
            </div>
          ) : null}
          {s.track === "quantity" ? (
            <div className="flex flex-wrap gap-x-5 gap-y-3">
              <NumberStepper label="Target" unit={s.unit || undefined} step={Number(s.step) || 1} min={1} value={s.target} onChange={(v) => (set("target", v), touch("target")())} error={shown("target")} />
              <NumberStepper label="Each tap adds" required min={1} max={999_999} value={s.step} onChange={(v) => (set("step", v), touch("step")())} error={shown("step")} />
            </div>
          ) : null}
          {s.track === "duration" ? (
            <NumberStepper label="Target" unit="min" step={5} min={1} max={1440} hint="Log time with +5 min taps." value={s.targetMin} onChange={(v) => (set("targetMin", v), touch("targetMin")())} error={shown("targetMin")} />
          ) : null}
          {s.track === "checklist" ? (
            <ListEditor
              legend="Step"
              rows={s.steps}
              onChange={(rows) => {
                set("steps", rows);
                setTouched((t) => new Set(t).add("steps"));
              }}
              max={30}
              maxLength={80}
              placeholder="e.g. Script"
              addLabel="Add step"
              error={shown("steps")}
            />
          ) : null}
          {s.track === "check" ? <p className="text-[12px] text-ink-2">One tap marks it done.</p> : null}
        </Section>
      )}

      <Section title="When">
        {s.kind === "group" ? (
          <Checkbox checked={!s.once} onChange={(v) => set("once", !v)}>
            Repeats
          </Checkbox>
        ) : null}
        {once ? (
          <>
            <PillGroup legend="Day" options={WHEN} value={s.when} onChange={(v) => set("when", v)} />
            {s.when !== "none" ? (
              <div className="grid grid-cols-2 gap-2">
                {s.when === "pick" ? (
                  <DateField
                    label="Date"
                    today={today}
                    value={s.picked}
                    onChange={(v) => {
                      set("picked", v);
                      touch("picked")();
                    }}
                    error={shown("picked")}
                  />
                ) : null}
                <TimeField label="Time (optional)" optional placeholder="Add time" value={s.time} onChange={(v) => set("time", v)} error={shown("time")} />
              </div>
            ) : (
              <p className="text-[12px] text-ink-2">Goes to Pending until you give it a day.</p>
            )}
          </>
        ) : (
          <>
            <PillGroup legend="Repeat" options={REPEATS} value={s.repeat} onChange={(v) => set("repeat", v)} />
            {s.repeat === "weekdays" ? (
              <fieldset>
                <legend className="sr-only">Days</legend>
                <div className="flex gap-1">
                  {WEEK.map(([day, label]) => {
                    const on = s.weekdays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          set("weekdays", on ? s.weekdays.filter((d) => d !== day) : [...s.weekdays, day]);
                          setTouched((t) => new Set(t).add("weekdays"));
                        }}
                        className={`h-9 flex-1 rounded-full text-[12px] font-medium ${on ? "bg-primary text-on-fill" : "bg-track text-ink hover:bg-border"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {shown("weekdays") ? <p role="alert" className="mt-1 text-[12px] text-ink">{errors.weekdays}</p> : null}
              </fieldset>
            ) : null}
            {s.repeat === "everyNDays" ? <NumberStepper label="Every" unit="days" required min={2} max={365} value={s.everyN} onChange={(v) => (set("everyN", v), touch("everyN")())} error={shown("everyN")} /> : null}
            {s.repeat === "monthly" ? (
              <NumberStepper label="On day" unit="of the month" required min={1} max={31} hint="Short months use their last day." value={s.monthDay} onChange={(v) => (set("monthDay", v), touch("monthDay")())} error={shown("monthDay")} />
            ) : null}
            <PillGroup legend="Time of day" options={TIME_OF_DAY} value={s.timeOfDay} onChange={(v) => set("timeOfDay", v)} />
            {s.timeOfDay === "time" ? (
              <TimeField
                label="Time"
                value={s.anchorTime}
                onChange={(v) => {
                  set("anchorTime", v);
                  touch("anchorTime")();
                }}
                error={shown("anchorTime")}
              />
            ) : null}
            {s.timeOfDay === "prayer" ? (
              <div className="space-y-2">
                <SegmentedTabs label="Before, at or after" options={[...RELATIONS]} value={s.anchorRelation} onChange={(v) => set("anchorRelation", v)} />
                <ChipChoice legend="Prayer" options={prayerOptions.map((p) => ({ value: p.key, label: p.title }))} value={s.anchorPrayer} onChange={(v) => set("anchorPrayer", v)} />
                <ChipChoice
                  legend="Plus"
                  options={(OFFSETS.includes(s.anchorOffset) ? OFFSETS : [...OFFSETS, s.anchorOffset].sort((a, b) => a - b)).map((m) => ({ value: m, label: m ? `${m} min` : "No delay" }))}
                  value={s.anchorOffset}
                  onChange={(v) => set("anchorOffset", v)}
                />
                <p className="text-[12px] text-ink-2">
                  {s.anchorRelation === "after"
                    ? "Shown from that prayer until the next one."
                    : s.anchorRelation === "before"
                      ? "Shown from the previous prayer until that one."
                      : "Shown for half an hour either side."}{" "}
                  It can still be ticked any time.
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <DateField label="Starts (optional)" optional placeholder="Any time" today={today} value={s.activeFrom} onChange={(v) => (set("activeFrom", v), touch("range")())} />
              <DateField label="Ends (optional)" optional placeholder="No end" today={today} value={s.activeUntil} onChange={(v) => (set("activeUntil", v), touch("range")())} error={shown("range")} />
            </div>
          </>
        )}
      </Section>

      <Section title="Importance">
        <SegmentedTabs label="Importance" options={[...PRIORITY]} value={s.priority} onChange={(v) => set("priority", v)} />
        <Checkbox checked={s.isOptional} onChange={(v) => set("isOptional", v)}>
          Optional — doesn&apos;t count toward the day&apos;s 100%
        </Checkbox>
        <div>
          <label htmlFor="item-notes" className="mb-1 block text-[12px] font-medium text-ink">
            Notes (optional)
          </label>
          <textarea
            id="item-notes"
            rows={2}
            maxLength={4000}
            value={s.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-2 focus:border-primary-strong"
          />
        </div>
      </Section>

      <ReminderSection
        value={reminder}
        onChange={setReminder}
        preview={{ priority: s.priority, schedule: valid ? toDraft(s, today).draft.schedule : (item?.schedule ?? { v: 1, kind: "daily" }), meta: item?.meta ?? {} }}
        settings={settings}
        category={allCategories.find((c) => c.id === s.categoryId) ?? null}
        prayerOptions={prayerOptions.filter((p) => p.key !== "sunrise")}
        showDays={!once}
      />

      <StickyActions>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="lg" className="flex-[2]" disabled={!valid}>
            {item ? "Save" : "Add"}
          </Button>
        </div>
        <DisabledHint show={!valid} message={firstError(errors) ?? reminderError ?? ""} />
      </StickyActions>
    </form>
  );
}
