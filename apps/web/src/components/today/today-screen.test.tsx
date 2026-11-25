import "fake-indexeddb/auto";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { todayLocalDate, type Item } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays } from "@/components/kit";
import { AddSheetProvider, useAddSheet } from "@/components/providers/add-sheet-provider";
import { LocalStore, type StoredRow } from "@/lib/v2/local-store";
import { pickDay } from "./pick-day.test-helper";
import { TodayScreen } from "./today-screen";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
let store: LocalStore;
const nav = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: USER, email: "me@example.com" } }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store, syncSoon: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push, replace: vi.fn() }) }));
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

/** Stand-in for the bottom nav's "+" (the nav isn't part of TodayScreen). */
function QuickAddButton() {
  const { openAdd } = useAddSheet();
  return (
    <button type="button" onClick={openAdd}>
      Open quick add
    </button>
  );
}

function renderToday() {
  return render(
    <AddSheetProvider>
      <QuickAddButton />
      <TodayScreen />
    </AddSheetProvider>,
  );
}

const ring = () => screen.getByRole("img", { name: /% of the day done/ });

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  store = await LocalStore.open(uid(), { sqlJs: SQL });
  nav.push.mockClear();
});

describe("TodayScreen", () => {
  it("shows one card per item with its amount; a ticked item stays where it is, crossed out", async () => {
    store.save("items", item({ title: "Steps", tracking: { v: 1, kind: "quantity", unit: "steps", target: 10000, step: 500 } }));
    store.save("items", item({ title: "Make bed" }));
    store.save("items", item({ type: "task", title: "Quiz", schedule: { v: 1, kind: "once", date: todayLocalDate() } }));
    renderToday();
    const list = await screen.findByRole("list", { name: "Items" });
    expect(within(list).getByText("Make bed")).toBeInTheDocument();
    expect(within(list).getByText("0 / 10,000 steps")).toBeInTheDocument();
    expect(within(list).getByText("Quiz")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Day summary" })).toHaveTextContent("0 / 3");

    fireEvent.click(screen.getByRole("checkbox", { name: "Quiz" }));
    await waitFor(() => expect(ring()).toHaveAttribute("data-value", "33")); // the % updates at once
    expect(screen.getByRole("region", { name: "Day summary" })).toHaveTextContent("1 / 3");
    expect(screen.getByRole("checkbox", { name: "Quiz" })).toHaveAttribute("aria-checked", "true");
    expect(within(list).getByText("Quiz")).toHaveClass("line-through");
  });

  it("tapping an item opens its page; its circle fills a count to the goal", async () => {
    const pages = item({ title: "Pages", tracking: { v: 1, kind: "quantity", unit: "pages", target: 5, step: 1 } });
    store.save("items", pages);
    renderToday();
    fireEvent.click(await screen.findByRole("button", { name: /^Pages/ }));
    expect(nav.push).toHaveBeenCalledWith(`/items/view?id=${pages.id}`);
    fireEvent.click(screen.getByRole("checkbox", { name: "Pages" }));
    expect(await screen.findByText("5 / 5 pages")).toBeInTheDocument();
    await waitFor(() => expect(ring()).toHaveAttribute("data-value", "100"));
  });

  it("reaches 100% when the only item is skipped (hold or right-click a card), and Bring back undoes it", async () => {
    store.save("items", item({ title: "Gym" }));
    renderToday();
    await waitFor(() => expect(ring()).toHaveAttribute("data-value", "0"));
    fireEvent.contextMenu(screen.getByText("Gym"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Skip today" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument(); // closes after the action
    await waitFor(() => expect(ring()).toHaveAttribute("data-value", "100"));
    fireEvent.click(screen.getByRole("button", { name: "Bring back" }));
    await waitFor(() => expect(ring()).toHaveAttribute("data-value", "0"));
  });

  it("adds a task to the day picked in the calendar (plan tomorrow)", async () => {
    renderToday();
    const tomorrow = addDays(todayLocalDate(), 1);
    await pickDay(tomorrow);
    expect(await screen.findByRole("heading", { level: 1, name: "Tomorrow" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Add a task" }));
    fireEvent.change(screen.getByLabelText(/What needs doing/), { target: { value: "Shoot at Café X" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    await waitFor(() => {
      const saved = store.query("items").find((r) => r.title === "Shoot at Café X") as unknown as Item | undefined;
      expect(saved?.schedule).toEqual({ v: 1, kind: "once", date: tomorrow });
    });
    expect(await screen.findByText("Shoot at Café X")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Added to Tomorrow/);
    fireEvent.click(screen.getByRole("button", { name: "Back to today" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
  });

  it("shows missed tasks under Overdue, with Move to today", async () => {
    const today = todayLocalDate();
    store.save("items", item({ type: "task", title: "Old essay", schedule: { v: 1, kind: "once", date: addDays(today, -2) } }));
    renderToday();
    const overdue = await screen.findByRole("region", { name: "Overdue" });
    expect(within(overdue).getByText(/^Was due/)).toBeInTheDocument();
    fireEvent.click(within(overdue).getByRole("button", { name: "Move to today" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Overdue" })).not.toBeInTheDocument());
    expect(within(screen.getByRole("list", { name: "Items" })).getByText("Old essay")).toBeInTheDocument();
  });

  it("toggles one prayer from the prayer card, in any order; the chevron opens the prayers' page", async () => {
    const group = item({ type: "group", title: "Daily prayers", meta: { prayerSet: true } });
    store.save("items", group);
    for (const t of ["Fajr", "Zuhr", "Asr"]) store.save("items", item({ title: t, parentId: group.id }));
    renderToday();
    fireEvent.click(await screen.findByRole("button", { name: "Asr, not marked" }));
    expect(await screen.findByRole("button", { name: "Asr, prayed" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "1 of 3 prayers prayed" })).toHaveTextContent("1 of 3 completed");
    await act(async () => undefined);
    expect(store.query("occurrences").filter((o) => o.status === "done")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /^Daily prayers/ }));
    expect(nav.push).toHaveBeenCalledWith(`/items/view?id=${group.id}`);
  });

  it("+ on a past day adds the task to today (a new task can't start in the past)", async () => {
    renderToday();
    await pickDay(addDays(todayLocalDate(), -3));
    // A past day doesn't invite planning; the + in the nav still works and adds to today.
    expect(await screen.findByText(/Nothing was planned for/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a task" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open quick add" }));
    fireEvent.change(screen.getByLabelText(/What needs doing/), { target: { value: "Call the bank" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    await waitFor(() => {
      const saved = store.query("items").find((r) => r.title === "Call the bank") as unknown as Item | undefined;
      expect(saved?.schedule).toEqual({ v: 1, kind: "once", date: todayLocalDate() });
    });
  });

  it("a routine's card counts its steps, and its circle ticks them all", async () => {
    const gym = item({ type: "group", title: "Gym — Push day" });
    store.save("items", gym);
    for (const t of ["Bench", "Dips"]) store.save("items", item({ title: t, parentId: gym.id }));
    renderToday();
    expect(await screen.findByText("0 / 2 steps")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Gym — Push day" }));
    expect(await screen.findByText("2 / 2 steps")).toBeInTheDocument();
    await waitFor(() => expect(ring()).toHaveAttribute("data-value", "100"));
  });
});

describe("Category pills", () => {
  const category = (name: string, icon: string, sortOrder: number) => {
    const c = { id: uid(), userId: USER, createdAt: NOW, updatedAt: NOW, deletedAt: null, name, icon, color: "mint", sortOrder, archivedAt: null, remindersMuted: false, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null };
    store.save("categories", c as unknown as StoredRow);
    return c;
  };

  it("show one area at a time; cards show the icon (not the name) and a flag for high priority", async () => {
    const physical = category("Physical", "dumbbell", 0);
    const mental = category("Mental", "brain", 1);
    store.save("items", item({ title: "Steps", categoryId: physical.id, priority: "high", tracking: { v: 1, kind: "quantity", unit: "steps", target: 1000, step: 500 } }));
    store.save("items", item({ title: "Journal", categoryId: mental.id }));
    renderToday();
    const pills = await screen.findByRole("group", { name: "Show a category" });
    expect(within(pills).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    const list = screen.getByRole("list", { name: "Items" });
    expect(within(list).getByRole("img", { name: "high priority" })).toBeInTheDocument();
    expect(within(list).queryByText("Physical")).not.toBeInTheDocument();

    fireEvent.click(within(pills).getByRole("button", { name: "Physical" }));
    expect(within(pills).getByRole("button", { name: "Physical" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Steps")).toBeInTheDocument();
    expect(screen.queryByText("Journal")).not.toBeInTheDocument();
    fireEvent.click(within(pills).getByRole("button", { name: "All" }));
    expect(screen.getByText("Journal")).toBeInTheDocument();
  });
});
