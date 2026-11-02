import { describe, expect, it } from "vitest";
import {
  addStep,
  buildDay,
  cadenceRuleSchema,
  checkCadence,
  createPlan,
  deletePlan,
  itemDependencySchema,
  itemSchema,
  lockOf,
  pendingItems,
  planProgress,
  removeStep,
  saveCadenceRule,
  setDependencies,
  toggleDone,
  updatePlan,
  updateStep,
  wouldCycle,
  type ActionContext,
  type CadenceRule,
  type Change,
  type Item,
  type ItemDependency,
  type Occurrence,
} from "../index.js";

const U = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const ctx: ActionContext = { userId: U, now: "2026-10-11T08:00:00.000Z", deviceId: "dev-1" };
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const CAT = "00000000-0000-4000-8000-0000000000ca";

type State = { items: Item[]; deps: ItemDependency[]; rules: CadenceRule[]; occs: Occurrence[] };
const empty = (): State => ({ items: [], deps: [], rules: [], occs: [] });
function apply(s: State, changes: Change[]) {
  for (const c of changes) {
    const list = (c.entity === "items" ? s.items : c.entity === "itemDependencies" ? s.deps : c.entity === "cadenceRules" ? s.rules : c.entity === "occurrences" ? s.occs : null) as { id: string }[] | null;
    if (!list) continue;
    const at = list.findIndex((r) => r.id === c.row.id);
    if (at >= 0) list[at] = c.row;
    else list.push(c.row);
  }
}
const live = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);
const plansOf = (s: State) => live(s.items).filter((i) => i.type === "plan");
const stepsOf = (s: State, plan: Item) => live(s.items).filter((i) => i.parentId === plan.id).sort((a, b) => a.sortOrder - b.sortOrder);
const byKind = (s: State, plan: Item, kind: string) => stepsOf(s, plan).find((i) => i.meta.stepKind === kind)!;

// Tue 13 Oct, Wed 14, Thu 15, Fri 16 Oct 2026.
const TUE = "2026-10-13";
const WED = "2026-10-14";
const THU = "2026-10-15";
const FRI = "2026-10-16";

function collab() {
  const s = empty();
  apply(s, createPlan(uid(), { preset: "collab", title: "Collab — Café X", categoryId: CAT, venue: "Café X", contact: "0300 1234567" }, 0, ctx, uid));
  const plan = plansOf(s)[0];
  return { s, plan };
}

describe("plans", () => {
  it("a content collab arrives with Shoot, Edit, Payment cleared, Post — Post waits for Payment", () => {
    const { s, plan } = collab();
    expect(plan).toMatchObject({ type: "plan", meta: { preset: "collab", venue: "Café X", contact: "0300 1234567" }, schedule: { kind: "once", date: null } });
    expect(stepsOf(s, plan).map((x) => x.title)).toEqual(["Shoot", "Edit", "Payment cleared", "Post"]);
    expect(live(s.deps)).toHaveLength(1);
    expect(live(s.deps)[0]).toMatchObject({ itemId: byKind(s, plan, "post").id, dependsOnId: byKind(s, plan, "payment").id });
    for (const d of s.deps) expect(() => itemDependencySchema.parse(d)).not.toThrow();
    for (const i of s.items) expect(() => itemSchema.parse(i)).not.toThrow();
  });

  it("Post stays locked until Payment cleared is ticked; steps show on Today on their dates, the plan never does", async () => {
    const { s, plan } = collab();
    apply(s, updateStep(byKind(s, plan, "shoot"), { date: TUE }, ctx));
    apply(s, updateStep(byKind(s, plan, "edit"), { date: WED }, ctx));
    apply(s, updateStep(byKind(s, plan, "post"), { date: FRI, time: "18:00" }, ctx));
    const post = byKind(s, plan, "post");
    expect(lockOf(post, s.deps, s.items, s.occs)).toMatchObject({ locked: true, waitingFor: [{ title: "Payment cleared" }] });

    const fri = buildDay(s.items, s.occs, FRI);
    expect(fri.map((e) => e.item.title)).toEqual(["Post"]);
    expect(fri[0].plan?.title).toBe("Collab — Café X");
    expect(buildDay(s.items, s.occs, TUE).map((e) => e.item.title)).toEqual(["Shoot"]);
    // Payment has no date → Pending (the plan itself never is).
    expect(pendingItems(s.items).map((i) => i.title)).toEqual(["Payment cleared"]);

    const paymentEntry = { key: "p", item: byKind(s, plan, "payment"), slot: "", occurrence: null };
    apply(s, await toggleDone(paymentEntry, "2026-10-12", ctx));
    expect(lockOf(post, s.deps, s.items, s.occs).locked).toBe(false);
  });

  it("the last step done completes the plan", async () => {
    const { s, plan } = collab();
    for (const st of stepsOf(s, plan)) apply(s, await toggleDone({ key: st.id, item: st, slot: "", occurrence: null }, TUE, ctx));
    expect(planProgress(plan, s.items, s.occs, TUE)).toMatchObject({ total: 4, done: 4, pct: 100, complete: true });
  });

  it("progress: next step, overdue and dateless steps", () => {
    const { s, plan } = collab();
    apply(s, updateStep(byKind(s, plan, "shoot"), { date: TUE }, ctx));
    apply(s, updateStep(byKind(s, plan, "edit"), { date: FRI }, ctx));
    expect(planProgress(plan, s.items, s.occs, WED)).toMatchObject({ total: 4, done: 0, overdue: 1, next: { title: "Edit" } });
  });

  it("dependencies can't loop or point at themselves", () => {
    const { s, plan } = collab();
    const [shoot, edit] = [byKind(s, plan, "shoot"), byKind(s, plan, "edit")];
    apply(s, setDependencies(edit, [shoot.id], s.deps, ctx, uid));
    expect(wouldCycle(shoot.id, [edit.id], s.deps)).toBe(true);
    expect(() => setDependencies(shoot, [edit.id], s.deps, ctx, uid)).toThrow(/loop/);
    expect(() => setDependencies(shoot, [shoot.id], s.deps, ctx, uid)).toThrow();
    // Replacing links removes the old one.
    apply(s, setDependencies(edit, [], s.deps, ctx, uid));
    expect(live(s.deps).filter((d) => d.itemId === edit.id)).toHaveLength(0);
  });

  it("removing a step removes its links; deleting the plan removes everything", () => {
    const { s, plan } = collab();
    apply(s, removeStep(byKind(s, plan, "payment"), s.deps, ctx));
    expect(live(s.deps)).toHaveLength(0);
    apply(s, saveCadenceRule({ scope: { planItemId: plan.id }, stepKind: "post", rule: { type: "gapDays", n: 1 } }, s.rules, ctx, uid));
    apply(s, deletePlan(plan, s.items, s.deps, s.rules, ctx));
    expect(live(s.items)).toHaveLength(0);
    expect(live(s.rules)).toHaveLength(0);
  });

  it("a category change moves the steps too", () => {
    const { s, plan } = collab();
    const other = "00000000-0000-4000-8000-0000000000cb";
    apply(s, updatePlan(plan, { categoryId: other, venue: "", notes: "Bring the ring light" }, s.items, ctx));
    expect(stepsOf(s, plan).every((x) => x.categoryId === other)).toBe(true);
    expect(plansOf(s)[0].meta.venue).toBeUndefined();
    expect(plansOf(s)[0].notes).toBe("Bring the ring light");
  });
});

describe("cadence (PLN-04)", () => {
  it("post Tue/Fri with gap ≥ 1: Thursday warns and suggests Friday; it never blocks", () => {
    const { s, plan } = collab();
    apply(s, saveCadenceRule({ scope: { planItemId: plan.id }, stepKind: "post", rule: { type: "weekdays", days: [2, 5] } }, s.rules, ctx, uid));
    apply(s, saveCadenceRule({ scope: { planItemId: plan.id }, stepKind: "post", rule: { type: "gapDays", n: 1 } }, s.rules, ctx, uid));
    for (const r of s.rules) expect(() => cadenceRuleSchema.parse(r)).not.toThrow();
    const post = byKind(s, plan, "post");
    const input = { step: post, plan, rules: s.rules, peers: s.items };
    const thu = checkCadence(THU, input);
    expect(thu.warnings[0]).toMatch(/Tue \/ Fri — Thursday isn't one of them/);
    expect(thu.suggestions[0]).toBe(FRI);
    expect(checkCadence(FRI, input)).toEqual({ warnings: [], suggestions: [] });
    // "Save anyway": the builder doesn't care about rules.
    apply(s, updateStep(post, { date: THU }, ctx));
    expect(byKind(s, plan, "post").schedule).toMatchObject({ date: THU });
  });

  it("category gap rule: posts across the category's plans stay n days apart", () => {
    const a = collab();
    const s = a.s;
    apply(s, createPlan(uid(), { preset: "collab", title: "Collab — Bistro Y", categoryId: CAT }, 1, ctx, uid));
    const b = plansOf(s).find((p) => p.title.includes("Bistro"))!;
    apply(s, updateStep(byKind(s, a.plan, "post"), { date: FRI }, ctx));
    apply(s, saveCadenceRule({ scope: { categoryId: CAT }, stepKind: "post", rule: { type: "gapDays", n: 2 } }, s.rules, ctx, uid));
    const res = checkCadence(THU, { step: byKind(s, b, "post"), plan: b, rules: s.rules, peers: s.items });
    expect(res.warnings[0]).toMatch(/Only 1 day from "Post"/);
    expect(res.suggestions[0]).toBe("2026-10-18");
    // A plan rule doesn't reach other plans.
    expect(checkCadence(THU, { step: byKind(s, b, "post"), plan: b, rules: [], peers: s.items }).warnings).toEqual([]);
  });

  it("saving a rule of the same type replaces it", () => {
    const { s, plan } = collab();
    apply(s, saveCadenceRule({ scope: { planItemId: plan.id }, stepKind: "post", rule: { type: "gapDays", n: 1 } }, s.rules, ctx, uid));
    apply(s, saveCadenceRule({ scope: { planItemId: plan.id }, stepKind: "post", rule: { type: "gapDays", n: 3 } }, s.rules, ctx, uid));
    expect(live(s.rules)).toHaveLength(1);
    expect(live(s.rules)[0].rule).toEqual({ type: "gapDays", n: 3 });
  });
});

describe("university (PLN-05)", () => {
  it("a quiz on 12 Oct 10:00 for DSA shows on Today on 12 Oct", () => {
    const s = empty();
    apply(s, createPlan(uid(), { preset: "university", title: "DSA", categoryId: CAT, course: "DSA" }, 0, ctx, uid));
    const plan = plansOf(s)[0];
    expect(stepsOf(s, plan)).toHaveLength(0);
    apply(s, addStep(plan, { kind: "quiz", title: "Quiz 2", date: "2026-10-12", time: "10:00" }, s.items, ctx, uid));
    const day = buildDay(s.items, s.occs, "2026-10-12");
    expect(day.map((e) => [e.item.title, e.item.schedule, e.plan?.meta.course])).toEqual([["Quiz 2", { v: 1, kind: "once", date: "2026-10-12", time: "10:00" }, "DSA"]]);
  });
});
