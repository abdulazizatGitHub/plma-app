import "fake-indexeddb/auto";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { buildDay, type Category, type Item } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ProgressPage from "@/app/(main)/progress/page";
import ItemViewPage from "@/app/(main)/items/view/page";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { RowActionsMenu } from "@/components/today/row-actions-menu";
import { LocalStore, type StoredRow } from "@/lib/v2/local-store";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
let store: LocalStore;
let params = new URLSearchParams();

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: USER, email: "me@example.com" }, getAccessToken: async () => "t" }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store, syncSoon: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }), useSearchParams: () => params }));
vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));

let SQL: SqlJsStatic;
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const CREATED = "2026-10-01T00:00:00.000Z";
const base = () => ({ id: uid(), userId: USER, createdAt: CREATED, updatedAt: CREATED, deletedAt: null });
const item = (over: Partial<Item>): Item => ({
  ...base(), categoryId: null, parentId: null, type: "habit", title: "Item", notes: null, priority: "medium", isOptional: false,
  tracking: { v: 1, kind: "check" }, schedule: { v: 1, kind: "daily" }, meta: {}, groupGoalId: null, sortOrder: 0, archivedAt: null,
  sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null, ...over,
});
const occ = (it: Item, date: string, status: string, value: number | null = null, detail: Record<string, unknown> | null = null) =>
  ({ ...base(), itemId: it.id, date, slot: "", status, value, detail, movedTo: null, movedFrom: null, startedAt: null, completedAt: null, deviceId: null }) as unknown as StoredRow;

let physical: Category;
let steps: Item;

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T04:00:00Z")); // Mon 12 Oct, 9 AM in Karachi
  store = await LocalStore.open(uid(), { sqlJs: SQL });
  physical = { ...base(), name: "Physical", icon: "dumbbell", color: "mint", sortOrder: 0, archivedAt: null, remindersMuted: false, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null } as Category;
  steps = item({ title: "Steps", categoryId: physical.id, tracking: { v: 1, kind: "quantity", unit: "steps", target: 1000, step: 500 } });
  store.save("categories", physical as unknown as StoredRow);
  store.save("items", steps as unknown as StoredRow);
  // Last week: done Mon–Wed (Wed logged late), nothing after.
  store.save("occurrences", occ(steps, "2026-10-05", "done", 1000, { target: 1000 }));
  store.save("occurrences", occ(steps, "2026-10-06", "done", 1000, { target: 1000 }));
  store.save("occurrences", occ(steps, "2026-10-07", "done", 1000, { target: 1000, late: true }));
  try {
    localStorage.removeItem("life_progress_period");
  } catch {
    /* ignore */
  }
});
afterEach(() => vi.useRealTimers());

describe("Progress", () => {
  it("opens on this week, pages back, and shows the average, trend-free insights and categories", () => {
    render(
      <AddSheetProvider>
        <ProgressPage />
      </AddSheetProvider>,
    );
    expect(screen.getByRole("tab", { name: "Week" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("This week")).toBeInTheDocument();
    // Nothing finished yet this week: no average, today "so far".
    expect(screen.getByRole("img", { name: "No finished days yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(screen.getByText("5 Oct – 11 Oct")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "43% average" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Insights" })).getByText(/Needs attention:/)).toHaveTextContent("Physical 43% — most missed: Steps");
    const cats = within(screen.getByRole("region", { name: "By category" }));
    expect(cats.getByText("3 done · 4 missed · 1 late")).toBeInTheDocument();
    // Each finished day links to Today.
    expect(screen.getByRole("link", { name: "5 Oct: 100%" })).toHaveAttribute("href", "/?date=2026-10-05");
  });

  it("month view uses the calendar", () => {
    render(
      <AddSheetProvider>
        <ProgressPage />
      </AddSheetProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Month" }));
    expect(screen.getByText("This month")).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "October 2026 history" })).toBeInTheDocument();
  });
});

describe("late days in the row menu", () => {
  const menu = (it: Item, date: string) => {
    store.save("items", it as unknown as StoredRow);
    const entry = buildDay([it], [], date)[0];
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    render(
      <AddSheetProvider>
        <RowActionsMenu target={{ entry, anchor }} date={date} today="2026-10-12" onClose={vi.fn()} />
      </AddSheetProvider>,
    );
  };

  it("a habit on a past day can't be skipped or moved (that would hide a miss), and gets no reminder", () => {
    menu(item({ title: "Read" }), "2026-10-11");
    expect(screen.queryByRole("menuitem", { name: /Skip/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Move/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Remind me…" })).not.toBeInTheDocument();
  });

  it("a one-off task from a past day can still move to today", () => {
    menu(item({ title: "Pay bill", type: "task", schedule: { v: 1, kind: "once", date: "2026-10-11" } }), "2026-10-11");
    expect(screen.getByRole("menuitem", { name: "Move to today" })).toBeInTheDocument();
  });
});

describe("item log", () => {
  it("lists the month's days newest first with values, missed days and the late mark", () => {
    params = new URLSearchParams({ id: steps.id });
    render(
      <AddSheetProvider>
        <ItemViewPage />
      </AddSheetProvider>,
    );
    const log = within(screen.getByRole("region", { name: "Log" }));
    const rows = log.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows[0]).toMatch(/^Mon 12 Oct/); // today first
    expect(rows.find((r) => r?.startsWith("Wed 7 Oct"))).toMatch(/1,000 \/ 1,000 steps.*Late/);
    expect(rows.find((r) => r?.startsWith("Thu 8 Oct"))).toMatch(/Missed/);
  });
});
