"use client";

import { todayLocalDate, type Category, type Item, type TaskDraft } from "@life/shared";
import { useState, type FormEvent } from "react";
import { DisabledHint } from "@/components/auth/auth-shell";
import { Button, Pill, SegmentedTabs, TextField, addDays } from "@/components/kit";
import { useForm } from "@/lib/forms/use-form";
import { useToday } from "@/lib/v2/use-today";
import { isoDate, taskTitle } from "@/lib/forms/validators";

type DateChoice = "today" | "tomorrow" | "pick" | "none";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

const CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function choiceFor(date: string | null, today: string): DateChoice {
  if (date === null) return "none";
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  return "pick";
}

type TaskFormProps = {
  categories: Category[];
  /** Pre-filled values (edit) or the default day (add). */
  initial: { title?: string; date: string | null; time?: string | null; categoryId?: string | null; priority?: Item["priority"] };
  /** Repeating items keep their schedule; only one-offs show the date field. */
  showDate?: boolean;
  submitLabel: string;
  onSubmit: (draft: TaskDraft) => void;
  /** Opens the full editor with what was typed so far. */
  onMoreOptions?: (draft: TaskDraft) => void;
  /** Opens the New-plan sheet (plans have several dated steps). */
  onNewPlan?: () => void;
};

/** Quick add / edit for tasks: title, day + optional time, category, importance. */
export function TaskForm({ categories, initial, showDate = true, submitLabel, onSubmit, onMoreOptions, onNewPlan }: TaskFormProps) {
  const today = useToday() ?? todayLocalDate();
  const form = useForm(
    {
      title: initial.title ?? "",
      choice: choiceFor(initial.date, today) as string,
      picked: initial.date ?? addDays(today, 2),
      time: initial.time ?? "",
    },
    {
      title: (v) => taskTitle(v),
      picked: (v, all) => (all.choice === "pick" ? isoDate(v) : null),
      time: (v) => (!v || CLOCK_RE.test(v) ? null : "Enter a valid time."),
    },
  );
  const choice = form.values.choice as DateChoice;
  const [categoryId, setCategoryId] = useState<string | null>(initial.categoryId ?? null);
  const [priority, setPriority] = useState<Item["priority"]>(initial.priority ?? "medium");

  const dateFor = (c: DateChoice): string | null =>
    c === "today" ? today : c === "tomorrow" ? addDays(today, 1) : c === "pick" ? form.values.picked : null;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.attempt()) return;
    const date = dateFor(choice);
    onSubmit({ title: form.values.title, date, time: date ? form.values.time || null : null, categoryId, priority });
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-3.5">
      <TextField label="What needs doing?" placeholder="e.g. Quiz — Data Structures" autoFocus required maxLength={200} {...form.field("title")} />

      {showDate ? (
        <fieldset>
          <legend className="mb-1 text-[12px] font-medium text-ink">When</legend>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["today", "Today"],
                ["tomorrow", "Tomorrow"],
                ["pick", "Pick date"],
                ["none", "No date"],
              ] as const
            ).map(([value, label]) => (
              <Pill key={value} selected={choice === value} onClick={() => form.set("choice", value)}>
                {label}
              </Pill>
            ))}
          </div>
          {choice !== "none" ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {choice === "pick" ? <TextField label="Date" type="date" required {...form.field("picked")} /> : null}
              <TextField label="Time (optional)" type="time" {...form.field("time")} />
            </div>
          ) : (
            <p className="mt-1.5 text-[12px] text-ink-2">Goes to Pending until you give it a day.</p>
          )}
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="mb-1 text-[12px] font-medium text-ink">Category</legend>
        <div className="flex flex-wrap gap-1.5">
          {[{ id: null, name: "None", color: "" }, ...categories].map((c) => (
            <Pill key={c.id ?? "none"} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              {c.id ? <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: `var(--cat-${c.color})` }} /> : null}
              {c.name}
            </Pill>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="mb-1 text-[12px] font-medium text-ink">Importance</p>
        <SegmentedTabs label="Importance" options={[...PRIORITY_OPTIONS]} value={priority} onChange={setPriority} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={!form.isValid}>
        {submitLabel}
      </Button>
      {onMoreOptions ? (
        <button
          type="button"
          onClick={() => {
            const date = dateFor(choice);
            onMoreOptions({ title: form.values.title, date, time: date ? form.values.time || null : null, categoryId, priority });
          }}
          className="flex min-h-8 w-full items-center justify-center text-[12px] font-medium text-link"
        >
          More options — repeat, count, checklist, routine
        </button>
      ) : null}
      {onNewPlan ? (
        <button type="button" onClick={onNewPlan} className="flex min-h-8 w-full items-center justify-center text-[12px] font-medium text-link">
          New plan — collab, course, multi-step work
        </button>
      ) : null}
      <DisabledHint
        show={!form.isValid}
        message={form.errors.title ? "Give the task a name to continue." : form.errors.picked ? "Pick a valid date to continue." : "Fix the time to continue."}
      />
    </form>
  );
}
