import "fake-indexeddb/auto";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { todayLocalDate, type Item } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays } from "@/components/kit";
import { SETTLE_MS } from "@/lib/v2/use-settle";

const SETTLED = { timeout: SETTLE_MS + 2000 };
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { LocalStore, type StoredRow } from "@/lib/v2/local-store";
import { TodayScreen } from "./today-screen";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
let store: LocalStore;

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: USER, email: "me@example.com" } }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store, syncSoon: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));

let SQL: SqlJsStatic;
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const NOW = new Date().toISOString();

function item(over: Partial<Item>): StoredRow {
  return {
    id: uid(),
    userId: USER,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    categoryId: null,
    parentId: null,
    type: "habit",
    title: "Item",
    notes: null,
    priority: "medium",
    isOptional: false,
    tracking: { v: 1, kind: "check" },
    schedule: { v: 1, kind: "daily" },
    meta: {},
    groupGoalId: null,
    sortOrder: n,
    archivedAt: null,
    sourceTemplateId: null,
    sourceTemplateVersion: null,
    adoptedAt: null,
    ...over,
  } as StoredRow;
}

function renderToday() {
  return render(
    <AddSheetProvider>
      <TodayScreen />
    </AddSheetProvider>,
  );
}

const ring = () => screen.getByRole("img", { name: /% of today done/ });

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  store = await LocalStore.open(uid(), { sqlJs: SQL });
});

describe("TodayScreen", () => {
  it("sorts today's items into To Do, In Progress and Done", async () => {
    const steps = item({ title: "Steps", tracking: { v: 1, kind: "quantity", unit: "steps", target: 10000, step: 500 } });
    store.save("items", steps);
    store.save("items", item({ title: "Make bed" }));
    store.save("items", item({ type: "task", title: "Quiz", schedule: { v: 1, kind: "once", date: todayLocalDate() } }));
    renderToday();
    const todo = await screen.findByRole("region", { name: "To Do" });
    expect(within(todo).getByText("Make bed")).toBeInTheDocument();

    // While you're editing, the row stays put and says where it's going…
    fireEvent.click(screen.getByRole("button", { name: "Increase Steps by 500" }));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "To Do" })).getByText("Steps")).toBeInTheDocument());
    expect(within(screen.getByRole("region", { name: "To Do" })).getAllByText("In Progress").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("checkbox", { name: "Quiz" }));
    await waitFor(() => expect(ring()).toHaveAttribute("data-value", "33")); // the % updates at once
    expect(within(screen.getByRole("region", { name: "To Do" })).getByText("Quiz")).toBeInTheDocument();
    // …and moves once it settles.
    await waitFor(() => expect(within(screen.getByRole("region", { name: "In Progress" })).getByText("Steps")).toBeInTheDocument(), SETTLED);
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Done" })).getByText("Quiz")).toBeInTheDocument(), SETTLED);
  });

  it("keeps a row in place while you keep tapping, then moves it", async () => {
    store.save("items", item({ title: "Pages", tracking: { v: 1, kind: "quantity", unit: "pages", target: 5, step: 1 } }));
    renderToday();
    const plus = await screen.findByRole("button", { name: "Increase Pages by 1" });
    for (let i = 0; i < 3; i++) {
      fireEvent.click(plus);
      await new Promise((r) => setTimeout(r, 900)); // each tap restarts the wait
    }
    expect(within(screen.getByRole("region", { name: "To Do" })).getByText("Pages")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "In Progress" })).not.toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole("region", { name: "In Progress" })).getByText("Pages")).toBeInTheDocument(), SETTLED);
  });

  it("reaches 100% when the only To Do item is skipped", async () => {
    store.save("items", item({ title: "Gym" }));
    renderToday();
    await waitFor(() => expect(ring()).toHaveAttribute("data-value", "0"));
    fireEvent.click(screen.getByRole("button", { name: "More actions for Gym" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Skip today" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument(); // closes after the action
    await waitFor(() => expect(ring()).toHaveAttribute("data-value", "100"));
    expect(screen.getByRole("button", { name: /Not today · 1/ })).toBeInTheDocument();
  });

  it("adds a task to the day that is on screen (plan tomorrow)", async () => {
    renderToday();
    const tomorrow = addDays(todayLocalDate(), 1);
    const label = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${tomorrow}T12:00:00`));
    await screen.findByRole("button", { name: "Next week" });
    // On a Sunday, tomorrow is in next week's strip.
    if (!screen.queryByRole("button", { name: new RegExp(`^${label}`) })) fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${label}`) }));
    fireEvent.click(await screen.findByRole("button", { name: "Add a task" }));
    fireEvent.change(screen.getByLabelText(/What needs doing/), { target: { value: "Shoot at Café X" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    await waitFor(() => {
      const saved = store.query("items").find((r) => r.title === "Shoot at Café X") as unknown as Item | undefined;
      expect(saved?.schedule).toEqual({ v: 1, kind: "once", date: tomorrow });
    });
    expect(await screen.findByText("Shoot at Café X")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Added to Tomorrow/);
  });

  it("shows later tasks under Upcoming and missed ones under Overdue, with Move to today", async () => {
    const today = todayLocalDate();
    store.save("items", item({ type: "task", title: "Late call", schedule: { v: 1, kind: "once", date: addDays(today, 1), time: "23:00" } }));
    store.save("items", item({ type: "task", title: "Old essay", schedule: { v: 1, kind: "once", date: addDays(today, -2) } }));
    renderToday();
    const upcoming = await screen.findByRole("region", { name: "Upcoming" });
    expect(within(upcoming).getByText("Late call")).toBeInTheDocument();
    expect(within(upcoming).getByText("11:00 PM")).toBeInTheDocument();
    HTMLElement.prototype.scrollIntoView = vi.fn(); // jsdom has no layout
    fireEvent.click(screen.getByRole("button", { name: "1 overdue" })); // badge by the date jumps to the list
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    const overdue = screen.getByRole("region", { name: "Overdue" });
    expect(within(overdue).getByText(/^Was due/)).toBeInTheDocument();
    fireEvent.click(within(overdue).getByRole("button", { name: "Move to today" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Overdue" })).not.toBeInTheDocument());
    expect(within(screen.getByRole("region", { name: "To Do" })).getByText("Old essay")).toBeInTheDocument();
  });

  it("toggles one prayer from the prayer row, in any order", async () => {
    const group = item({ type: "group", title: "Daily prayers", meta: { prayerSet: true } });
    store.save("items", group);
    for (const t of ["Fajr", "Zuhr", "Asr"]) store.save("items", item({ title: t, parentId: group.id }));
    renderToday();
    fireEvent.click(await screen.findByRole("button", { name: "Asr, not marked" }));
    expect(await screen.findByRole("button", { name: "Asr, prayed" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "1 of 3 prayers prayed" })).toBeInTheDocument();
    await act(async () => undefined);
    expect(store.query("occurrences").filter((o) => o.status === "done")).toHaveLength(1);
  });
});
