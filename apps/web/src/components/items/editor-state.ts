import type { Anchor, ChildDraft, EditableItemType, Item, ItemDraft, Schedule, Tracking } from "@life/shared";
import { addDays } from "@/components/kit";
import { endNotBefore, isoDate, taskTitle, wholeNumber } from "@/lib/forms/validators";
import { newRow, type ListRow } from "./list-editor";

/*
 * The full item editor's state, validation and conversion to an ItemDraft
 * (Phase 3, ITM-01…07, TRK-02…04, SCH-02). Pure, so it is unit-tested.
 */

export type TrackKind = Tracking["kind"];
export type RepeatKind = "daily" | "weekdays" | "everyNDays" | "monthly";
export type DateChoice = "today" | "tomorrow" | "pick" | "none";
export type TimeOfDay = "any" | "time" | "prayer";
export type Relation = "before" | "at" | "after";

export type EditorState = {
  kind: EditableItemType;
  title: string;
  categoryId: string | null;
  priority: Item["priority"];
  isOptional: boolean;
  notes: string;
  track: TrackKind;
  unit: string;
  target: string;
  step: string;
  targetMin: string;
  steps: ListRow[];
  /** One-off: task, or a routine that doesn't repeat. */
  once: boolean;
  when: DateChoice;
  picked: string;
  time: string;
  repeat: RepeatKind;
  weekdays: number[];
  everyN: string;
  monthDay: string;
  activeFrom: string;
  activeUntil: string;
  /** Repeating items: when in the day (SCH-03/04). */
  timeOfDay: TimeOfDay;
  anchorTime: string;
  anchorPrayer: string;
  anchorRelation: Relation;
  /** Minutes after the anchor point, 0–120 (prayer anchors). */
  anchorOffset: number;
  children: ListRow[];
};

export type EditorPreset = {
  kind?: EditableItemType;
  title?: string;
  categoryId?: string | null;
  date?: string | null;
  time?: string | null;
  priority?: Item["priority"];
};

const CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function choiceFor(date: string | null | undefined, today: string): DateChoice {
  if (date === null) return "none";
  if (!date || date === today) return "today";
  return date === addDays(today, 1) ? "tomorrow" : "pick";
}

export function initialState(item: Item | null, children: Item[], preset: EditorPreset, today: string): EditorState {
  const t = item?.tracking;
  const s = item?.schedule;
  const kind: EditableItemType = item ? (item.type === "group" ? "group" : item.type === "task" ? "task" : "habit") : (preset.kind ?? "task");
  const onceDate = s?.kind === "once" ? s.date : preset.date;
  return {
    kind,
    title: item?.title ?? preset.title ?? "",
    categoryId: item ? item.categoryId : (preset.categoryId ?? null),
    priority: item?.priority ?? preset.priority ?? "medium",
    isOptional: item?.isOptional ?? false,
    notes: item?.notes ?? "",
    track: t?.kind ?? "check",
    unit: t?.kind === "quantity" ? t.unit : "",
    target: t?.kind === "quantity" && t.target !== undefined ? String(t.target) : "",
    step: t?.kind === "quantity" ? String(t.step) : "1",
    targetMin: t?.kind === "duration" && t.targetMin !== undefined ? String(t.targetMin) : "",
    steps: t?.kind === "checklist" ? t.steps.map((x) => newRow(x)) : [newRow(), newRow()],
    once: s ? s.kind === "once" : kind === "task",
    when: choiceFor(onceDate, today),
    picked: onceDate ?? addDays(today, 2),
    time: (s?.kind === "once" ? s.time : preset.time) ?? "",
    repeat: s && s.kind !== "once" ? s.kind : "daily",
    weekdays: s?.kind === "weekdays" ? [...s.weekdays] : [1, 2, 3, 4, 5],
    everyN: s?.kind === "everyNDays" ? String(s.n) : "2",
    monthDay: s?.kind === "monthly" ? String(s.monthDay) : String(Number(today.slice(8, 10))),
    activeFrom: s && s.kind !== "once" ? (s.activeFrom ?? "") : "",
    activeUntil: s && s.kind !== "once" ? (s.activeUntil ?? "") : "",
    ...anchorState(s && s.kind !== "once" ? s.anchor : undefined),
    children: children.length ? children.filter((c) => !c.deletedAt).map((c) => newRow(c.title, c.id)) : [newRow(), newRow()],
  };
}

function anchorState(a: Anchor | undefined): Pick<EditorState, "timeOfDay" | "anchorTime" | "anchorPrayer" | "anchorRelation" | "anchorOffset"> {
  if (a?.type === "time") return { timeOfDay: "time", anchorTime: a.time, anchorPrayer: "dhuhr", anchorRelation: "after", anchorOffset: 0 };
  if (a?.type === "prayer") return { timeOfDay: "prayer", anchorTime: "", anchorPrayer: a.prayer === "zuhr" ? "dhuhr" : a.prayer, anchorRelation: a.relation, anchorOffset: a.offsetMin ?? 0 };
  return { timeOfDay: "any", anchorTime: "", anchorPrayer: "dhuhr", anchorRelation: "after", anchorOffset: 0 };
}

export type EditorErrors = Partial<Record<"title" | "unit" | "target" | "step" | "targetMin" | "steps" | "picked" | "time" | "weekdays" | "everyN" | "monthDay" | "range" | "anchorTime" | "children", string>>;

const filled = (rows: ListRow[]) => rows.filter((r) => r.title.trim());

/** Tasks are always one-off, habits always repeat; routines choose. */
export const isOnce = (s: EditorState) => (s.kind === "task" ? true : s.kind === "habit" ? false : s.once);

export function validate(s: EditorState): EditorErrors {
  const e: EditorErrors = {};
  const set = (key: keyof EditorErrors, msg: string | null) => {
    if (msg) e[key] = msg;
  };
  set("title", taskTitle(s.title));
  if (s.kind !== "group") {
    if (s.track === "quantity") {
      set("unit", s.unit.trim() ? (s.unit.trim().length > 24 ? "Keep the unit under 24 characters." : null) : "Add a unit, e.g. steps or pages.");
      set("target", s.target ? wholeNumber("Target", 1, 1_000_000)(s.target) : null);
      set("step", wholeNumber("Step", 1, 100_000)(s.step));
    }
    if (s.track === "duration") set("targetMin", s.targetMin ? wholeNumber("Minutes", 1, 1440)(s.targetMin) : null);
    if (s.track === "checklist") {
      const steps = filled(s.steps);
      set("steps", steps.length === 0 ? "Add at least one step." : steps.length > 30 ? "Up to 30 steps." : null);
    }
  }
  if (isOnce(s)) {
    if (s.when === "pick") set("picked", isoDate(s.picked));
    if (s.when !== "none" && s.time) set("time", CLOCK_RE.test(s.time) ? null : "Enter a valid time.");
  } else {
    if (s.repeat === "weekdays") set("weekdays", s.weekdays.length ? null : "Pick at least one day.");
    if (s.repeat === "everyNDays") set("everyN", wholeNumber("Days", 2, 365)(s.everyN));
    if (s.repeat === "monthly") set("monthDay", wholeNumber("Day of the month", 1, 31)(s.monthDay));
    if (s.timeOfDay === "time") set("anchorTime", CLOCK_RE.test(s.anchorTime) ? null : "Pick a time of day.");
    if (s.activeFrom) set("range", isoDate(s.activeFrom));
    if (s.activeUntil) set("range", isoDate(s.activeUntil) ?? endNotBefore(s.activeFrom, s.activeUntil));
  }
  if (s.kind === "group") set("children", filled(s.children).length ? null : "Add at least one sub-item.");
  return e;
}

/** The first problem, for the hint under the disabled Save button. */
export function firstError(e: EditorErrors): string | null {
  return Object.values(e)[0] ?? null;
}

function tracking(s: EditorState): Tracking {
  if (s.kind === "group") return { v: 1, kind: "check" };
  switch (s.track) {
    case "quantity":
      return { v: 1, kind: "quantity", unit: s.unit.trim(), step: Number(s.step), ...(s.target ? { target: Number(s.target) } : {}) };
    case "duration":
      return { v: 1, kind: "duration", ...(s.targetMin ? { targetMin: Number(s.targetMin) } : {}) };
    case "checklist":
      return { v: 1, kind: "checklist", steps: filled(s.steps).map((r) => r.title.trim()) };
    default:
      return { v: 1, kind: "check" };
  }
}

function schedule(s: EditorState, today: string): Schedule {
  if (isOnce(s)) {
    const date = s.when === "today" ? today : s.when === "tomorrow" ? addDays(today, 1) : s.when === "pick" ? s.picked : null;
    return date && s.time ? { v: 1, kind: "once", date, time: s.time } : { v: 1, kind: "once", date };
  }
  const anchor: Anchor | undefined =
    s.timeOfDay === "time"
      ? { type: "time", time: s.anchorTime }
      : s.timeOfDay === "prayer"
        ? { type: "prayer", prayer: s.anchorPrayer, relation: s.anchorRelation, offsetMin: s.anchorOffset }
        : undefined;
  const range = {
    ...(anchor ? { anchor } : {}),
    ...(s.activeFrom ? { activeFrom: s.activeFrom } : {}),
    ...(s.activeUntil ? { activeUntil: s.activeUntil } : {}),
  };
  switch (s.repeat) {
    case "weekdays":
      return { v: 1, kind: "weekdays", weekdays: [...s.weekdays].sort(), ...range };
    case "everyNDays":
      return { v: 1, kind: "everyNDays", n: Number(s.everyN), ...range };
    case "monthly":
      return { v: 1, kind: "monthly", monthDay: Number(s.monthDay), ...range };
    default:
      return { v: 1, kind: "daily", ...range };
  }
}

export function toDraft(s: EditorState, today: string): { draft: ItemDraft; children: ChildDraft[] } {
  return {
    draft: {
      type: s.kind,
      title: s.title,
      categoryId: s.categoryId,
      priority: s.priority,
      isOptional: s.isOptional,
      notes: s.notes || null,
      tracking: tracking(s),
      schedule: schedule(s, today),
    },
    children: s.kind === "group" ? filled(s.children).map((r) => ({ id: r.id, title: r.title })) : [],
  };
}
