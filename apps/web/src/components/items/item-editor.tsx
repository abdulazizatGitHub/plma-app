"use client";

import { createItem, saveChildren, todayLocalDate, updateItem, type Change, type Item } from "@life/shared";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { DisabledHint } from "@/components/auth/auth-shell";
import { Button, Checkbox, Pill, PillGroup, SegmentedTabs, TextField } from "@/components/kit";
import { sanitizeDigits } from "@/lib/forms/validators";
import { categoryTone } from "@/lib/v2/category-style";
import { useActions, useCategories, useNextSortOrder } from "@/lib/v2/use-day";
import { firstError, initialState, isOnce, toDraft, validate, type EditorPreset, type EditorState } from "./editor-state";
import { ListEditor } from "./list-editor";

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
  const today = useMemo(() => todayLocalDate(), []);
  const categories = useCategories();
  const run = useActions();
  const nextSortOrder = useNextSortOrder();
  const [s, setState] = useState<EditorState>(() => initialState(item, existingChildren, preset, today));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const errors = validate(s);
  const valid = Object.keys(errors).length === 0;
  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) => setState((prev) => ({ ...prev, [key]: value }));
  const touch = (key: string) => () => setTouched((t) => new Set(t).add(key));
  const shown = (key: keyof typeof errors) => (touched.has(key) ? (errors[key] ?? null) : null);
  const digits = (key: "target" | "step" | "targetMin" | "everyN" | "monthDay", max = 7) => ({
    value: s[key],
    inputMode: "numeric" as const,
    onChange: (e: { target: { value: string } }) => set(key, sanitizeDigits(e.target.value, max)),
    onBlur: touch(key),
    error: shown(key),
  });

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
      return changes;
    }).then(() => {
      if (saved) onSaved(saved, !item);
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
                {c.id ? <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: `var(--cat-${categoryTone(c)})` }} /> : null}
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
            <div className="grid grid-cols-3 gap-2">
              <TextField label="Unit" placeholder="steps" required maxLength={24} value={s.unit} onChange={(e) => set("unit", e.target.value)} onBlur={touch("unit")} error={shown("unit")} />
              <TextField label="Target" placeholder="10000" {...digits("target")} />
              <TextField label="Step" required placeholder="500" {...digits("step", 6)} />
            </div>
          ) : null}
          {s.track === "duration" ? <TextField label="Target minutes" placeholder="20" hint="Log time with +5 min taps." {...digits("targetMin", 4)} /> : null}
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
                  <TextField label="Date" type="date" required value={s.picked} onChange={(e) => set("picked", e.target.value)} onBlur={touch("picked")} error={shown("picked")} />
                ) : null}
                <TextField label="Time (optional)" type="time" value={s.time} onChange={(e) => set("time", e.target.value)} onBlur={touch("time")} error={shown("time")} />
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
            {s.repeat === "everyNDays" ? <TextField label="Every how many days?" required {...digits("everyN", 3)} /> : null}
            {s.repeat === "monthly" ? <TextField label="Day of the month" required hint="Short months use their last day." {...digits("monthDay", 2)} /> : null}
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Starts (optional)" type="date" value={s.activeFrom} onChange={(e) => set("activeFrom", e.target.value)} onBlur={touch("range")} />
              <TextField label="Ends (optional)" type="date" value={s.activeUntil} onChange={(e) => set("activeUntil", e.target.value)} onBlur={touch("range")} error={shown("range")} />
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

      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className="flex-[2]" disabled={!valid}>
          {item ? "Save" : "Add"}
        </Button>
      </div>
      <DisabledHint show={!valid} message={firstError(errors) ?? ""} />
    </form>
  );
}
