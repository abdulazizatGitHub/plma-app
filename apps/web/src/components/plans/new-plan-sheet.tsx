"use client";

import { PLAN_PRESETS, createPlan, type PlanPreset } from "@life/shared";
import { useRouter } from "next/navigation";
import { createElement, useState, type FormEvent } from "react";
import { DisabledHint } from "@/components/auth/auth-shell";
import { Button, Pill, Sheet, TextField } from "@/components/kit";
import { useForm } from "@/lib/forms/use-form";
import { taskTitle } from "@/lib/forms/validators";
import { categoryTone } from "@/lib/v2/category-style";
import { useActions, useCategories, useNextSortOrder } from "@/lib/v2/use-day";
import { PRESET_ICON } from "./plan-icons";

const PRESETS: PlanPreset[] = ["collab", "university", "blank"];

function NewPlanForm({ onDone }: { onDone: () => void }) {
  const run = useActions();
  const router = useRouter();
  const categories = useCategories();
  const nextSortOrder = useNextSortOrder();
  // A sensible default category: Content for collabs, University for courses.
  const guess = (p: PlanPreset) =>
    categories.find((c) => (p === "collab" ? /content/i : p === "university" ? /universit|study/i : /^$/).test(c.name))?.id ?? null;
  const [categoryId, setCategoryId] = useState<string | null>(() => guess("collab"));
  const form = useForm(
    { preset: "collab" as string, title: "", venue: "", contact: "", course: "" },
    {
      // A course plan may take the course as its name.
      title: (v, all) => (all.preset === "university" && !v.trim() && all.course.trim() ? null : taskTitle(v)),
      course: (v, all) => (all.preset === "university" && !v.trim() ? "Add the course, e.g. DSA." : null),
    },
  );
  const { values } = form;
  const preset = values.preset as PlanPreset;
  const setPreset = (p: PlanPreset) => form.set("preset", p);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.attempt()) return;
    const id = crypto.randomUUID();
    const title = values.title.trim() || values.course.trim();
    void run((ctx) =>
      createPlan(id, { preset, title, categoryId, venue: values.venue, contact: values.contact, course: values.course }, nextSortOrder(), ctx, () => crypto.randomUUID()),
    ).then(() => router.push(`/plans/view?id=${id}`));
    onDone();
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-3.5">
      <div role="radiogroup" aria-label="Kind of plan" className="grid gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={preset === p}
            onClick={() => {
              setPreset(p);
              setCategoryId(guess(p));
            }}
            className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left ${preset === p ? "border-primary-strong bg-primary/10" : "border-border hover:bg-track"}`}
          >
            <span className="mt-0.5 text-ink-2" aria-hidden>
              {createElement(PRESET_ICON[p], { className: "h-4.5 w-4.5" })}
            </span>
            <span>
              <span className="block text-[14px] font-medium text-ink">{PLAN_PRESETS[p].label}</span>
              <span className="block text-[12px] text-ink-2">{PLAN_PRESETS[p].description}</span>
            </span>
          </button>
        ))}
      </div>

      {preset === "university" ? (
        <TextField label="Course" placeholder="e.g. DSA" required maxLength={80} {...form.field("course")} />
      ) : null}
      <TextField
        label={preset === "university" ? "Plan name (optional)" : "Plan name"}
        placeholder={preset === "collab" ? "e.g. Collab — Café X" : preset === "university" ? "Defaults to the course" : "e.g. Move house"}
        required={preset !== "university"}
        maxLength={200}
        {...form.field("title")}
      />
      {preset === "collab" ? (
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Venue" placeholder="Café X, Gulberg" maxLength={120} {...form.field("venue")} />
          <TextField label="Contact" placeholder="Name or number" maxLength={120} {...form.field("contact")} />
        </div>
      ) : null}

      <fieldset>
        <legend className="mb-1 text-[12px] font-medium text-ink">Category</legend>
        <div className="flex flex-wrap gap-1.5">
          {[{ id: null, name: "None", color: "" }, ...categories].map((c) => (
            <Pill key={c.id ?? "none"} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              {c.id ? <span aria-hidden className="h-2.5 w-2.5 rounded-full ring-1 ring-ink/25" style={{ background: `var(--cat-${categoryTone(c)})` }} /> : null}
              {c.name}
            </Pill>
          ))}
        </div>
      </fieldset>

      <Button type="submit" size="lg" className="w-full" disabled={!form.isValid}>
        Create plan
      </Button>
      <DisabledHint show={!form.isValid} message={Object.values(form.errors)[0] ?? ""} />
    </form>
  );
}

/** "New plan": pick a preset (content collab, university course, blank) and the basics (PLN-01, PLN-05). */
export function NewPlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="New plan">
      {open ? <NewPlanForm onDone={onClose} /> : null}
    </Sheet>
  );
}
