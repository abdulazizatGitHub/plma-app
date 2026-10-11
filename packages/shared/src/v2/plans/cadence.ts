import type { CadenceRule, Item } from "../entities.js";
import { daysBetween, weekdayOf } from "../schedule.js";
import { STEP_KINDS, isStepKind } from "./presets.js";

/*
 * CadenceChecker (PLN-04, SYSTEM_DESIGN §5.4): when a step's date is picked,
 * check the plan's and its category's rules for that kind of step:
 *   - weekdays: the step should fall on one of these days
 *   - gapDays:  at least n days from other steps of the same kind (in the
 *               plan for plan rules; across the category's plans for
 *               category rules)
 * It warns and suggests the next valid dates. It never blocks a save.
 */

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const stepKindOf = (step: Pick<Item, "meta">) => (isStepKind(step.meta.stepKind) ? step.meta.stepKind : "custom");
const dateOf = (i: Item) => (i.schedule.kind === "once" ? i.schedule.date : null);

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export type CadenceInput = {
  step: Pick<Item, "id" | "meta" | "title">;
  plan: Pick<Item, "id" | "categoryId">;
  rules: CadenceRule[];
  /** Other steps that can conflict: this plan's, and (for category rules) other plans' in the same category. */
  peers: Item[];
};

export type CadenceResult = { warnings: string[]; suggestions: string[] };

/** Rules that apply to this step: the plan's own, plus its category's. */
export function rulesFor(input: Pick<CadenceInput, "step" | "plan" | "rules">): CadenceRule[] {
  const kind = stepKindOf(input.step);
  return input.rules.filter(
    (r) => !r.deletedAt && r.stepKind === kind && (r.planItemId === input.plan.id || (r.planItemId === null && r.categoryId !== null && r.categoryId === input.plan.categoryId)),
  );
}

function violations(date: string, input: CadenceInput): string[] {
  const kind = stepKindOf(input.step);
  const label = STEP_KINDS[kind].label;
  const out: string[] = [];
  for (const r of rulesFor(input)) {
    if (r.rule.type === "weekdays") {
      if (!r.rule.days.includes(weekdayOf(date))) {
        out.push(`${label} is set for ${r.rule.days.map((d) => DAY[d]).join(" / ")} — ${DAY_LONG[weekdayOf(date)]} isn't one of them.`);
      }
    } else {
      const n = r.rule.n;
      const scope = input.peers.filter(
        (p) => p.id !== input.step.id && !p.deletedAt && stepKindOf(p) === kind && dateOf(p) && (r.planItemId === null || p.parentId === input.plan.id),
      );
      const close = scope.find((p) => Math.abs(daysBetween(dateOf(p) as string, date)) < n);
      if (close) {
        const gap = Math.abs(daysBetween(dateOf(close) as string, date));
        out.push(`Only ${gap} day${gap === 1 ? "" : "s"} from "${close.title}" (${dateOf(close)}) — keep ${label.toLowerCase()} steps at least ${n} day${n === 1 ? "" : "s"} apart.`);
      }
    }
  }
  return out;
}

/** Warnings for `date`, and (when there are any) the next three dates that fit every rule. */
export function checkCadence(date: string, input: CadenceInput): CadenceResult {
  const warnings = violations(date, input);
  if (!warnings.length) return { warnings, suggestions: [] };
  const suggestions: string[] = [];
  for (let i = 1; i <= 120 && suggestions.length < 3; i++) {
    const d = addDays(date, i);
    if (!violations(d, input).length) suggestions.push(d);
  }
  return { warnings, suggestions };
}
