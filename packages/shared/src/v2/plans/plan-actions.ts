import type { ActionContext, Change } from "../actions.js";
import { cadenceRuleSchema, itemDependencySchema, itemSchema, type CadenceRule, type Item, type ItemDependency } from "../entities.js";
import { wouldCycle } from "./plan-state.js";
import { PLAN_PRESETS, STEP_KINDS, type PlanPreset, type StepKind } from "./presets.js";

/*
 * Builders for plans (PLN-01…05). A plan is an item of type "plan" (never on
 * Today itself); its steps are one-off tasks with `parentId` = the plan and
 * `meta.stepKind`. "Waits for" links are item_dependencies rows; cadence rules
 * are cadence_rules rows. Like every builder here, they only return rows.
 */

const live = <T extends { deletedAt: string | null }>(r: T) => !r.deletedAt;
const base = (id: string, ctx: ActionContext) => ({ id, userId: ctx.userId, createdAt: ctx.now, updatedAt: ctx.now, deletedAt: null });
const noProvenance = { sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null } as const;
const itm = (row: Item): Change => ({ entity: "items", row: itemSchema.parse(row) });
const dep = (row: ItemDependency): Change => ({ entity: "itemDependencies", row: itemDependencySchema.parse(row) });

export type PlanDraft = {
  preset: PlanPreset;
  title: string;
  categoryId: string | null;
  venue?: string;
  contact?: string;
  course?: string;
  notes?: string | null;
};

const clean = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);

function planMeta(draft: Pick<PlanDraft, "preset" | "venue" | "contact" | "course">): Record<string, unknown> {
  const meta: Record<string, unknown> = { preset: draft.preset };
  for (const key of ["venue", "contact", "course"] as const) {
    const v = clean(draft[key]);
    if (v) meta[key] = v;
  }
  return meta;
}

export type StepDraft = { kind: StepKind; title?: string; date?: string | null; time?: string | null; course?: string };

function stepItem(id: string, plan: Item, draft: StepDraft, sortOrder: number, ctx: ActionContext): Item {
  const date = draft.date ?? null;
  const meta: Record<string, unknown> = { stepKind: draft.kind };
  const course = clean(draft.course);
  if (course) meta.course = course;
  return {
    ...base(id, ctx),
    categoryId: plan.categoryId,
    parentId: plan.id,
    type: "task",
    title: (draft.title?.trim() || STEP_KINDS[draft.kind].label).slice(0, 200),
    notes: null,
    priority: "medium",
    isOptional: false,
    tracking: { v: 1, kind: "check" },
    schedule: date && draft.time ? { v: 1, kind: "once", date, time: draft.time } : { v: 1, kind: "once", date },
    meta,
    groupGoalId: null,
    sortOrder,
    archivedAt: null,
    ...noProvenance,
  };
}

/** A new plan with its preset's steps and "waits for" links. */
export function createPlan(id: string, draft: PlanDraft, sortOrder: number, ctx: ActionContext, newId: () => string): Change[] {
  const plan: Item = {
    ...base(id, ctx),
    categoryId: draft.categoryId,
    parentId: null,
    type: "plan",
    title: draft.title.trim(),
    notes: draft.notes?.trim() ? draft.notes.trim() : null,
    priority: "medium",
    isOptional: false,
    tracking: { v: 1, kind: "check" },
    schedule: { v: 1, kind: "once", date: null },
    meta: planMeta(draft),
    groupGoalId: null,
    sortOrder,
    archivedAt: null,
    ...noProvenance,
  };
  const changes: Change[] = [itm(plan)];
  const byKind = new Map<StepKind, Item>();
  PLAN_PRESETS[draft.preset].steps.forEach((s, i) => {
    const step = stepItem(newId(), plan, { kind: s.kind }, i, ctx);
    byKind.set(s.kind, step);
    changes.push(itm(step));
  });
  for (const s of PLAN_PRESETS[draft.preset].steps) {
    for (const on of s.dependsOn ?? []) {
      const a = byKind.get(s.kind);
      const b = byKind.get(on);
      if (a && b) changes.push(dep({ ...base(newId(), ctx), itemId: a.id, dependsOnId: b.id }));
    }
  }
  return changes;
}

export type PlanPatch = Partial<Pick<PlanDraft, "title" | "venue" | "contact" | "course" | "notes" | "categoryId">>;

/** Edit the plan's fields; its steps follow a category change. */
export function updatePlan(plan: Item, patch: PlanPatch, steps: Item[], ctx: ActionContext): Change[] {
  const meta = { ...plan.meta };
  for (const key of ["venue", "contact", "course"] as const) {
    if (!(key in patch)) continue;
    const v = clean(patch[key]);
    if (v) meta[key] = v;
    else delete meta[key];
  }
  const next: Item = {
    ...plan,
    title: patch.title !== undefined ? patch.title.trim() : plan.title,
    notes: patch.notes !== undefined ? (patch.notes?.trim() ? patch.notes.trim() : null) : plan.notes,
    categoryId: patch.categoryId !== undefined ? patch.categoryId : plan.categoryId,
    meta,
    updatedAt: ctx.now,
  };
  const changes = [itm(next)];
  if (next.categoryId !== plan.categoryId) {
    for (const s of steps) if (s.parentId === plan.id && live(s)) changes.push(itm({ ...s, categoryId: next.categoryId, updatedAt: ctx.now }));
  }
  return changes;
}

export function addStep(plan: Item, draft: StepDraft, steps: Item[], ctx: ActionContext, newId: () => string): Change[] {
  const order = steps.filter((s) => s.parentId === plan.id && live(s)).reduce((max, s) => Math.max(max, s.sortOrder + 1), 0);
  return [itm(stepItem(newId(), plan, draft, order, ctx))];
}

export type StepPatch = Partial<Pick<StepDraft, "title" | "date" | "time" | "kind" | "course">>;

/** Date, time, title, kind or course of a step. A cleared date sends it to "No date yet". */
export function updateStep(step: Item, patch: StepPatch, ctx: ActionContext): Change[] {
  const cur = step.schedule.kind === "once" ? step.schedule : { date: null, time: undefined };
  const date = patch.date !== undefined ? patch.date : cur.date;
  const time = patch.time !== undefined ? patch.time : cur.time;
  const meta = { ...step.meta };
  if (patch.kind) meta.stepKind = patch.kind;
  if (patch.course !== undefined) {
    const c = clean(patch.course);
    if (c) meta.course = c;
    else delete meta.course;
  }
  return [
    itm({
      ...step,
      title: patch.title !== undefined && patch.title.trim() ? patch.title.trim() : step.title,
      schedule: date && time ? { v: 1, kind: "once", date, time } : { v: 1, kind: "once", date: date ?? null },
      meta,
      updatedAt: ctx.now,
    }),
  ];
}

/** Remove a step and any "waits for" links to or from it. */
export function removeStep(step: Item, deps: ItemDependency[], ctx: ActionContext): Change[] {
  return [
    itm({ ...step, deletedAt: ctx.now, updatedAt: ctx.now }),
    ...deps.filter((d) => live(d) && (d.itemId === step.id || d.dependsOnId === step.id)).map((d) => dep({ ...d, deletedAt: ctx.now, updatedAt: ctx.now })),
  ];
}

/**
 * "This step waits for…" (PLN-02): makes the step's links match `dependsOnIds`.
 * Throws if that would make a step wait on itself, directly or in a loop.
 */
export function setDependencies(step: Item, dependsOnIds: string[], deps: ItemDependency[], ctx: ActionContext, newId: () => string): Change[] {
  const wanted = [...new Set(dependsOnIds)];
  if (wouldCycle(step.id, wanted, deps)) throw new Error("That would make steps wait on each other in a loop.");
  const current = deps.filter((d) => live(d) && d.itemId === step.id);
  const changes: Change[] = [];
  for (const d of current) if (!wanted.includes(d.dependsOnId)) changes.push(dep({ ...d, deletedAt: ctx.now, updatedAt: ctx.now }));
  for (const id of wanted) if (!current.some((d) => d.dependsOnId === id)) changes.push(dep({ ...base(newId(), ctx), itemId: step.id, dependsOnId: id }));
  return changes;
}

export type CadenceRuleDraft = { scope: { planItemId: string } | { categoryId: string }; stepKind: StepKind; rule: CadenceRule["rule"] };

/** Add or replace the rule of this type for this kind and scope (one per type). */
export function saveCadenceRule(draft: CadenceRuleDraft, rules: CadenceRule[], ctx: ActionContext, newId: () => string): Change[] {
  const planItemId = "planItemId" in draft.scope ? draft.scope.planItemId : null;
  const categoryId = "categoryId" in draft.scope ? draft.scope.categoryId : null;
  const same = rules.find((r) => live(r) && r.stepKind === draft.stepKind && r.rule.type === draft.rule.type && r.planItemId === planItemId && r.categoryId === categoryId);
  const row: CadenceRule = same
    ? { ...same, rule: draft.rule, updatedAt: ctx.now }
    : { ...base(newId(), ctx), categoryId, planItemId, stepKind: draft.stepKind, rule: draft.rule };
  return [{ entity: "cadenceRules", row: cadenceRuleSchema.parse(row) }];
}

export function deleteCadenceRule(rule: CadenceRule, ctx: ActionContext): Change[] {
  return [{ entity: "cadenceRules", row: cadenceRuleSchema.parse({ ...rule, deletedAt: ctx.now, updatedAt: ctx.now }) }];
}

/** Delete a plan with its steps, links and plan rules. */
export function deletePlan(plan: Item, steps: Item[], deps: ItemDependency[], rules: CadenceRule[], ctx: ActionContext): Change[] {
  const mine = steps.filter((s) => s.parentId === plan.id && live(s));
  const ids = new Set(mine.map((s) => s.id));
  return [
    itm({ ...plan, deletedAt: ctx.now, updatedAt: ctx.now }),
    ...mine.map((s) => itm({ ...s, deletedAt: ctx.now, updatedAt: ctx.now })),
    ...deps.filter((d) => live(d) && (ids.has(d.itemId) || ids.has(d.dependsOnId))).map((d) => dep({ ...d, deletedAt: ctx.now, updatedAt: ctx.now })),
    ...rules.filter((r) => live(r) && r.planItemId === plan.id).map((r) => ({ entity: "cadenceRules" as const, row: cadenceRuleSchema.parse({ ...r, deletedAt: ctx.now, updatedAt: ctx.now }) })),
  ];
}
