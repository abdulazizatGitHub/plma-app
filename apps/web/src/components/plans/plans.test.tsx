import "fake-indexeddb/auto";
import { fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { createPlan, todayLocalDate, updateStep, type CadenceRule, type Item, type ItemDependency, type Occurrence } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pickDate } from "@/test/date-field";
import PlansPage from "@/app/(main)/plans/page";
import PlanViewPage from "@/app/(main)/plans/view/page";
import CategoryViewPage from "@/app/(main)/categories/view/page";
import { TodayScreen } from "@/components/today/today-screen";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { LocalStore, type StoredRow } from "@/lib/v2/local-store";
import { usePending } from "@/lib/v2/use-day";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
let store: LocalStore;
let params = new URLSearchParams();
const push = vi.fn();

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: USER, email: "me@example.com" } }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store, syncSoon: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }), useSearchParams: () => params }));
vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));

let SQL: SqlJsStatic;
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  store = await LocalStore.open(uid(), { sqlJs: SQL });
  params = new URLSearchParams();
  push.mockReset();
});

const items = () => store.query("items", `WHERE "deleted_at" IS NULL`) as unknown as Item[];
const deps = () => store.query("itemDependencies", `WHERE "deleted_at" IS NULL`) as unknown as ItemDependency[];
const page = () =>
  render(
    <AddSheetProvider>
      <PlansPage />
    </AddSheetProvider>,
  );

describe("Plans page", () => {
  it("creates a content collab with its four steps and Post waiting for Payment", async () => {
    page();
    fireEvent.click((await screen.findAllByRole("button", { name: /New plan/ }))[0]);
    const sheet = screen.getByRole("dialog", { name: "New plan" });
    expect(within(sheet).getByRole("radio", { name: /Content collab/ })).toHaveAttribute("aria-checked", "true");
    expect(within(sheet).getByRole("button", { name: "Create plan" })).toBeDisabled();
    fireEvent.change(within(sheet).getByLabelText(/^Plan name/), { target: { value: "Collab — Café X" } });
    fireEvent.change(within(sheet).getByLabelText("Venue"), { target: { value: "Café X" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Create plan" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/plans\/view\?id=/)));
    const plan = items().find((i) => i.type === "plan")!;
    expect(plan).toMatchObject({ title: "Collab — Café X", meta: { preset: "collab", venue: "Café X" } });
    expect(items().filter((i) => i.parentId === plan.id).map((i) => i.title).sort()).toEqual(["Edit", "Payment cleared", "Post", "Shoot"]);
    expect(deps()).toHaveLength(1);
    expect(await screen.findByRole("link", { name: "Collab — Café X" })).toHaveTextContent(/Next: Shoot · no date yet/);
  });

  it("a university course needs its course; the plan takes the course as its name", async () => {
    params = new URLSearchParams({ new: "1" }); // opened from + → New plan
    page();
    const sheet = await screen.findByRole("dialog", { name: "New plan" });
    fireEvent.click(within(sheet).getByRole("radio", { name: /University course/ }));
    const create = within(sheet).getByRole("button", { name: "Create plan" });
    expect(create).toBeDisabled();
    fireEvent.change(within(sheet).getByLabelText(/^Course/), { target: { value: "DSA" } });
    expect(create).toBeEnabled();
    fireEvent.click(create);
    await waitFor(() => expect(items().find((i) => i.type === "plan")).toMatchObject({ title: "DSA", meta: { preset: "university", course: "DSA" } }));
  });
});

function seedCollab() {
  const id = uid();
  const ctx = { userId: USER, now: "2026-10-11T08:00:00.000Z", deviceId: null };
  for (const c of createPlan(id, { preset: "collab", title: "Collab — Café X", categoryId: null, venue: "Café X" }, 0, ctx, uid)) store.save(c.entity, c.row as unknown as StoredRow);
  params = new URLSearchParams({ id });
  return id;
}
const view = () =>
  render(
    <AddSheetProvider>
      <PlanViewPage />
    </AddSheetProvider>,
  );
const stepRow = (title: string) => screen.getByRole("listitem", { name: title });

describe("Plan page", () => {
  it("Post is locked until Payment cleared is ticked", async () => {
    seedCollab();
    view();
    await screen.findByRole("heading", { name: "Collab — Café X" });
    expect(within(stepRow("Post")).getByRole("img", { name: "Locked: waits for Payment cleared" })).toBeInTheDocument();
    expect(within(stepRow("Post")).queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(within(stepRow("Payment cleared")).getByRole("checkbox", { name: "Payment cleared" }));
    await waitFor(() => expect(within(stepRow("Post")).getByRole("checkbox", { name: "Post" })).toBeInTheDocument());
    expect((store.query("occurrences") as unknown as Occurrence[])[0]).toMatchObject({ status: "done" });
    // Done, so no longer pending (it never had a date).
    const { result } = renderHook(() => usePending());
    expect(result.current.map((i) => i.title)).not.toContain("Payment cleared");
  });

  it("rules: post on Tue/Fri, gap ≥ 1 — Thursday warns and suggests Friday; the date is kept", async () => {
    seedCollab();
    view();
    await screen.findByRole("heading", { name: "Collab — Café X" });
    const postRules = within(screen.getByRole("listitem", { name: "Post rules" }));
    // Quick taps: both land on the same rule.
    fireEvent.click(postRules.getByRole("button", { name: "Tue" }));
    fireEvent.click(postRules.getByRole("button", { name: "Fri" }));
    fireEvent.click(within(postRules.getByRole("group", { name: /^Keep post steps apart by/ })).getByRole("button", { name: "1 day+" }));
    await waitFor(() => {
      const rules = (store.query("cadenceRules") as unknown as CadenceRule[]).filter((r) => !r.deletedAt);
      expect(rules.map((r) => r.rule)).toEqual(expect.arrayContaining([{ type: "weekdays", days: [2, 5] }, { type: "gapDays", n: 1 }]));
      expect(rules).toHaveLength(2);
    });
    pickDate("Post date", "2026-10-15", stepRow("Post")); // a Thursday
    // The dated step moves from "No date yet" to the timeline, so look it up again.
    const status = await waitFor(() => within(stepRow("Post")).getByRole("status"));
    expect(status).toHaveTextContent(/Tue \/ Fri — Thursday isn't one of them/);
    expect(within(status).getByRole("button", { name: "Fri 16 Oct" })).toBeInTheDocument();
    // Saved anyway.
    expect((store.query("items") as unknown as Item[]).find((i) => i.title === "Post")?.schedule).toMatchObject({ date: "2026-10-15" });
    fireEvent.click(within(status).getByRole("button", { name: "Fri 16 Oct" }));
    await waitFor(() => expect(within(stepRow("Post")).queryByRole("status")).not.toBeInTheDocument());
  });

  it("Waits for… refuses a loop and explains why", async () => {
    seedCollab();
    view();
    await screen.findByRole("heading", { name: "Collab — Café X" });
    fireEvent.click(screen.getByRole("button", { name: "More actions for Payment cleared" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Waits for…" }));
    const sheet = screen.getByRole("dialog", { name: "Waits for…" });
    fireEvent.click(within(sheet).getByRole("checkbox", { name: "Post" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Save" }));
    expect(within(sheet).getByRole("alert")).toHaveTextContent(/loop/);
    expect(deps()).toHaveLength(1);
  });
});

describe("Plans on Today and in categories", () => {
  it("a step shows on its date with its plan; a locked one explains why instead of ticking", async () => {
    seedCollab();
    const post = items().find((i) => i.title === "Post")!;
    const [c] = updateStep(post, { date: todayLocalDate(), time: "18:00" }, { userId: USER, now: "2026-10-11T09:00:00.000Z", deviceId: null });
    store.save(c.entity, c.row as unknown as StoredRow);
    render(
      <AddSheetProvider>
        <TodayScreen />
      </AddSheetProvider>,
    );
    const lockBtn = await screen.findByRole("button", { name: "Post: locked — Payment cleared" });
    expect(screen.getByText("Collab — Café X")).toBeInTheDocument();
    expect(screen.getByText("Waits for Payment cleared")).toBeInTheDocument();
    fireEvent.click(lockBtn);
    expect(await screen.findByRole("status")).toHaveTextContent("Post waits for Payment cleared — tick that first.");
    expect(store.query("occurrences")).toHaveLength(0);
  });

  it("a content category with no active plans says Nothing upcoming, with no warnings", async () => {
    const cat = { id: uid(), userId: USER, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", deletedAt: null, name: "Content", icon: "video", color: "sky", sortOrder: 0, archivedAt: null, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null };
    store.save("categories", cat as unknown as StoredRow);
    params = new URLSearchParams({ id: cat.id });
    render(
      <AddSheetProvider>
        <CategoryViewPage />
      </AddSheetProvider>,
    );
    const plans = await screen.findByRole("region", { name: "Plans" });
    expect(within(plans).getByText("Nothing upcoming.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("deleting a plan step from Today removes its waits-for links too", async () => {
    seedCollab();
    const post = items().find((i) => i.title === "Post")!;
    const [c] = updateStep(post, { date: todayLocalDate() }, { userId: USER, now: "2026-10-11T09:00:00.000Z", deviceId: null });
    store.save(c.entity, c.row as unknown as StoredRow);
    render(
      <AddSheetProvider>
        <TodayScreen />
      </AddSheetProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "More actions for Post" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    await waitFor(() => expect(items().some((i) => i.title === "Post")).toBe(false));
    expect(deps()).toHaveLength(0);
  });
});

