"use client";

import {
  PLAN_PRESETS,
  STEP_KINDS,
  addStep,
  deletePlan,
  isPlanPreset,
  lockOf,
  planProgress,
  removeStep,
  setDependencies,
  stepDone,
  stepKindOf,
  toggleDone,
  updatePlan,
  updateStep,
  type Item,
  type StepKind,
} from "@life/shared";
import { ArrowLeft, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, createElement, useMemo, useState, type FormEvent } from "react";
import { Button, ConfirmSheet, Pill, PopoverMenu, PopoverMenuDivider, PopoverMenuItem, Ring, Sheet, Tag, TextField } from "@/components/kit";
import { PRESET_ICON, stepIcon } from "@/components/plans/plan-icons";
import { RulesEditor } from "@/components/plans/rules-editor";
import { StepRow } from "@/components/plans/step-row";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { categoryTone } from "@/lib/v2/category-style";
import { useActions, useCategories } from "@/lib/v2/use-day";
import { useToday } from "@/lib/v2/use-today";
import { usePlansData } from "@/lib/v2/use-plans";

const dateOf = (i: Item) => (i.schedule.kind === "once" ? i.schedule.date : null);
const timeOf = (i: Item) => (i.schedule.kind === "once" ? (i.schedule.time ?? "") : "");
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Plan details: venue, contact, course, notes, category, name. */
function DetailsForm({ plan, onSave }: { plan: Item; onSave: (patch: { title: string; venue: string; contact: string; course: string; notes: string; categoryId: string | null }) => void }) {
  const categories = useCategories();
  const [v, setV] = useState({ title: plan.title, venue: str(plan.meta.venue), contact: str(plan.meta.contact), course: str(plan.meta.course), notes: plan.notes ?? "" });
  const [categoryId, setCategoryId] = useState(plan.categoryId);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (v.title.trim()) onSave({ ...v, categoryId });
  };
  return (
    <form noValidate onSubmit={submit} className="space-y-3">
      <TextField label="Plan name" required maxLength={200} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} error={v.title.trim() ? null : "Give the plan a name."} />
      <div className="grid grid-cols-2 gap-2">
        <TextField label="Venue" maxLength={120} value={v.venue} onChange={(e) => setV({ ...v, venue: e.target.value })} />
        <TextField label="Contact" maxLength={120} value={v.contact} onChange={(e) => setV({ ...v, contact: e.target.value })} />
      </div>
      <TextField label="Course" maxLength={80} value={v.course} onChange={(e) => setV({ ...v, course: e.target.value })} />
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-ink">Notes</span>
        <textarea rows={3} maxLength={4000} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} className="w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-primary-strong" />
      </label>
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
      <Button type="submit" size="lg" className="w-full" disabled={!v.title.trim()}>
        Save
      </Button>
    </form>
  );
}

/** Rename a step, change its kind or course. */
function StepForm({ step, kinds, onSave }: { step: Item; kinds: StepKind[]; onSave: (patch: { title: string; kind: StepKind; course: string }) => void }) {
  const [title, setTitle] = useState(step.title);
  const [kind, setKind] = useState<StepKind>(stepKindOf(step));
  const [course, setCourse] = useState(str(step.meta.course));
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSave({ title, kind, course });
      }}
      className="space-y-3"
    >
      <TextField label="Step name" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      <fieldset>
        <legend className="mb-1 text-[12px] font-medium text-ink">Kind</legend>
        <div className="flex flex-wrap gap-1.5">
          {[...new Set([...kinds, stepKindOf(step)])].map((k) => (
            <Pill key={k} selected={kind === k} onClick={() => setKind(k)}>
              {STEP_KINDS[k].label}
            </Pill>
          ))}
        </div>
      </fieldset>
      <TextField label="Course (optional)" maxLength={80} value={course} onChange={(e) => setCourse(e.target.value)} />
      <Button type="submit" size="lg" className="w-full" disabled={!title.trim()}>
        Save
      </Button>
    </form>
  );
}

/** "This step waits for…" (PLN-02). */
function WaitsForForm({ step, others, current, onSave }: { step: Item; others: Item[]; current: string[]; onSave: (ids: string[]) => string | null }) {
  const [picked, setPicked] = useState<string[]>(current);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-ink-2">
        <b className="text-ink">{step.title}</b> stays locked until these are done.
      </p>
      <ul className="space-y-1">
        {others.map((o) => {
          const on = picked.includes(o.id);
          return (
            <li key={o.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => setPicked(on ? picked.filter((x) => x !== o.id) : [...picked, o.id])}
                className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 text-left text-[14px] text-ink hover:bg-track"
              >
                <span aria-hidden className={`h-4.5 w-4.5 rounded-[5px] border-2 ${on ? "border-primary-strong bg-primary-strong" : "border-ink-2"}`} />
                {o.title}
              </button>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-[12px] text-ink">
          {error}
        </p>
      ) : null}
      <Button size="lg" className="w-full" onClick={() => setError(onSave(picked))}>
        Save
      </Button>
    </div>
  );
}

type Panel = { kind: "details" } | { kind: "step"; step: Item } | { kind: "waits"; step: Item } | { kind: "remove"; step: Item } | { kind: "delete" } | null;

/** One plan (PLN-01…05): timeline, locks, cadence warnings, rules, details. */
function PlanView() {
  const id = useSearchParams().get("id");
  const data = usePlansData();
  const run = useActions();
  const router = useRouter();
  const { notify } = useAddSheet();
  const categories = useCategories();
  const today = useToday();
  const [menu, setMenu] = useState<{ step: Item; anchor: HTMLElement } | null>(null);
  const [panel, setPanel] = useState<Panel>(null);

  const plan = data.plans.find((p) => p.id === id) ?? null;
  const steps = useMemo(() => (plan ? data.steps.filter((s) => s.parentId === plan.id) : []), [data.steps, plan]);
  // Peers for category rules: steps of every plan in the same category.
  const peers = useMemo(() => {
    if (!plan) return [];
    const sameCategory = new Set(data.plans.filter((p) => p.id === plan.id || (plan.categoryId && p.categoryId === plan.categoryId)).map((p) => p.id));
    return data.steps.filter((s) => s.parentId && sameCategory.has(s.parentId));
  }, [data.plans, data.steps, plan]);

  if (!data.ready || !today) return <div className="skeleton h-40" aria-busy="true" aria-label="Loading plan" />;
  if (!plan) return <p className="card px-5 py-6 text-center text-[14px] text-ink">This plan doesn&apos;t exist anymore.</p>;

  const preset = isPlanPreset(plan.meta.preset) ? plan.meta.preset : "blank";
  const progress = planProgress(plan, data.steps, data.occs, today);
  const dated = steps.filter((s) => dateOf(s)).sort((a, b) => `${dateOf(a)}${timeOf(a)}`.localeCompare(`${dateOf(b)}${timeOf(b)}`) || a.sortOrder - b.sortOrder);
  const undated = steps.filter((s) => !dateOf(s));
  const kinds = [...new Set([...steps.map(stepKindOf), ...PLAN_PRESETS[preset].quickAdd].filter((k) => k !== "custom" && STEP_KINDS[k].dated))];
  const category = categories.find((c) => c.id === plan.categoryId) ?? null;
  const newId = () => crypto.randomUUID();
  const occurrenceOf = (step: Item) => data.occs.filter((o) => o.itemId === step.id && o.slot === "").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;

  const toggle = (step: Item) => {
    const occurrence = occurrenceOf(step);
    const wasComplete = progress.complete;
    const finishing = !stepDone(step, data.occs) && progress.done === progress.total - 1;
    void run((ctx) => toggleDone({ key: step.id, item: step, slot: "", occurrence }, occurrence?.date ?? dateOf(step) ?? today, ctx)).then(() => {
      if (finishing && !wasComplete) notify({ message: `Plan complete — ${plan.title}` });
    });
  };

  const row = (step: Item) => (
    <StepRow
      key={step.id}
      step={step}
      plan={plan}
      done={stepDone(step, data.occs)}
      waitingFor={lockOf(step, data.deps, data.steps, data.occs).waitingFor}
      rules={data.rules}
      peers={peers}
      occurrence={occurrenceOf(step)}
      onToggle={() => toggle(step)}
      onDate={(date, time) => void run((ctx) => updateStep(step, { date, time }, ctx))}
      onMore={(anchor) => setMenu({ step, anchor })}
    />
  );

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => router.push("/plans")} className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Plans
      </button>
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-track text-ink" aria-hidden>
          {createElement(PRESET_ICON[preset], { className: "h-5 w-5" })}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-ink">{plan.title}</h1>
          <div className="mt-1 flex flex-wrap gap-1">
            <Tag>{PLAN_PRESETS[preset].label}</Tag>
            {category ? <Tag color={`var(--cat-${categoryTone(category)})`}>{category.name}</Tag> : null}
            {str(plan.meta.venue) ? <Tag>{str(plan.meta.venue)}</Tag> : null}
            {str(plan.meta.contact) ? <Tag>{str(plan.meta.contact)}</Tag> : null}
            {str(plan.meta.course) ? <Tag>Course: {str(plan.meta.course)}</Tag> : null}
            {progress.complete ? <Tag tone="done">Complete</Tag> : null}
          </div>
          {plan.notes ? <p className="mt-1.5 text-[13px] whitespace-pre-wrap text-ink-2">{plan.notes}</p> : null}
        </div>
        <Ring label={`${progress.done} of ${progress.total} steps done`} value={progress.pct} size={44} stroke={5} />
      </header>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => setPanel({ kind: "details" })}>
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit details
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPanel({ kind: "delete" })}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete plan
        </Button>
      </div>

      <section aria-label="Timeline" className="space-y-2">
        <h2 className="text-[15px] font-semibold text-ink">Timeline</h2>
        {dated.length ? <ol className="space-y-2">{dated.map(row)}</ol> : <p className="text-[13px] text-ink-2">No dated steps yet — pick dates below.</p>}
      </section>
      {undated.length ? (
        <section aria-label="No date yet" className="space-y-2">
          <h2 className="text-[15px] font-semibold text-ink">No date yet</h2>
          <ol className="space-y-2">{undated.map(row)}</ol>
        </section>
      ) : null}

      <section aria-label="Add a step" className="space-y-1.5">
        <h2 className="text-[13px] font-semibold text-ink">Add a step</h2>
        <div className="flex flex-wrap gap-1.5">
          {PLAN_PRESETS[preset].quickAdd.map((k) => (
            <Pill
              key={k}
              selected={false}
              onClick={() =>
                void run((ctx) => addStep(plan, { kind: k, course: str(plan.meta.course) || undefined }, data.steps, ctx, newId)).then(() =>
                  notify({ message: `Added ${STEP_KINDS[k].label} — pick its date` }),
                )
              }
            >
              <Plus className="h-3 w-3" aria-hidden />
              {createElement(stepIcon(k), { className: "h-3 w-3" })} {STEP_KINDS[k].label}
            </Pill>
          ))}
        </div>
      </section>

      <RulesEditor plan={plan} kinds={kinds} rules={data.rules} categoryName={category?.name ?? null} />

      {menu ? (
        <PopoverMenu anchor={menu.anchor} onClose={() => setMenu(null)} label={menu.step.title}>
          <PopoverMenuItem
            icon={<Pencil />}
            label="Rename / kind / course"
            onClick={() => {
              setPanel({ kind: "step", step: menu.step });
              setMenu(null);
            }}
          />
          <PopoverMenuItem
            icon={<Link2 />}
            label="Waits for…"
            onClick={() => {
              setPanel({ kind: "waits", step: menu.step });
              setMenu(null);
            }}
          />
          <PopoverMenuDivider />
          <PopoverMenuItem
            icon={<Trash2 />}
            label="Remove step"
            tone="danger"
            onClick={() => {
              setPanel({ kind: "remove", step: menu.step });
              setMenu(null);
            }}
          />
        </PopoverMenu>
      ) : null}

      <Sheet open={panel?.kind === "details"} onClose={() => setPanel(null)} title="Plan details">
        {panel?.kind === "details" ? (
          <DetailsForm
            plan={plan}
            onSave={(patch) => {
              void run((ctx) => updatePlan(plan, patch, data.steps, ctx));
              setPanel(null);
            }}
          />
        ) : null}
      </Sheet>
      <Sheet open={panel?.kind === "step"} onClose={() => setPanel(null)} title="Edit step">
        {panel?.kind === "step" ? (
          <StepForm
            step={panel.step}
            kinds={PLAN_PRESETS[preset].quickAdd}
            onSave={(patch) => {
              const step = panel.step;
              void run((ctx) => updateStep(step, patch, ctx));
              setPanel(null);
            }}
          />
        ) : null}
      </Sheet>
      <Sheet open={panel?.kind === "waits"} onClose={() => setPanel(null)} title="Waits for…">
        {panel?.kind === "waits" ? (
          <WaitsForForm
            step={panel.step}
            others={steps.filter((s) => s.id !== panel.step.id)}
            current={data.deps.filter((d) => d.itemId === panel.step.id).map((d) => d.dependsOnId)}
            onSave={(ids) => {
              const step = panel.step;
              try {
                // Checked here first so the sheet can show the reason.
                setDependencies(step, ids, data.deps, { userId: step.userId, now: new Date().toISOString(), deviceId: null }, newId);
              } catch (e) {
                return (e as Error).message;
              }
              void run((ctx) => setDependencies(step, ids, data.deps, ctx, newId));
              setPanel(null);
              return null;
            }}
          />
        ) : null}
      </Sheet>
      <ConfirmSheet
        open={panel?.kind === "remove"}
        title={`Remove “${panel?.kind === "remove" ? panel.step.title : ""}”?`}
        body="Its links to other steps are removed too."
        confirmLabel="Remove"
        onConfirm={() => {
          if (panel?.kind === "remove") {
            const step = panel.step;
            void run((ctx) => removeStep(step, data.deps, ctx));
          }
        }}
        onClose={() => setPanel(null)}
      />
      <ConfirmSheet
        open={panel?.kind === "delete"}
        title={`Delete “${plan.title}”?`}
        body="The plan, its steps, links and plan rules are deleted."
        confirmLabel="Delete"
        onConfirm={() => {
          void run((ctx) => deletePlan(plan, data.steps, data.deps, data.rules, ctx));
          notify({ message: `Deleted “${plan.title}”` });
          router.push("/plans");
        }}
        onClose={() => setPanel(null)}
      />
    </div>
  );
}

export default function PlanViewPage() {
  return (
    <Suspense fallback={<div className="skeleton h-40" aria-busy="true" aria-label="Loading plan" />}>
      <PlanView />
    </Suspense>
  );
}
