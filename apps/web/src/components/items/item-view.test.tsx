import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { todayLocalDate, type Item } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ItemViewPage from "@/app/(main)/items/view/page";
import { addDays } from "@/components/kit";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { LocalStore, type StoredRow } from "@/lib/v2/local-store";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
let store: LocalStore;
let params = new URLSearchParams();

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: USER, email: "me@example.com" } }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store, syncSoon: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }), useSearchParams: () => params }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));

let SQL: SqlJsStatic;
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  store = await LocalStore.open(uid(), { sqlJs: SQL });
});

function seedSteps(created: string): Item {
  const row = {
    id: uid(),
    userId: USER,
    createdAt: `${created}T06:00:00.000Z`,
    updatedAt: `${created}T06:00:00.000Z`,
    deletedAt: null,
    categoryId: null,
    parentId: null,
    type: "habit",
    title: "Steps",
    notes: "Walk after Asr.",
    priority: "high",
    isOptional: false,
    tracking: { v: 1, kind: "quantity", unit: "steps", target: 10000, step: 500 },
    schedule: { v: 1, kind: "daily" },
    meta: {},
    groupGoalId: null,
    sortOrder: 0,
    archivedAt: null,
    sourceTemplateId: null,
    sourceTemplateVersion: null,
    adoptedAt: null,
  };
  store.save("items", row as StoredRow);
  return row as unknown as Item;
}

function log(item: Item, date: string, value: number) {
  store.save("occurrences", {
    id: uid(),
    userId: USER,
    createdAt: `${date}T20:00:00.000Z`,
    updatedAt: `${date}T20:00:00.000Z`,
    deletedAt: null,
    itemId: item.id,
    date,
    slot: "",
    status: value >= 10000 ? "done" : "in_progress",
    value,
    detail: null,
    movedTo: null,
    movedFrom: null,
    startedAt: null,
    completedAt: null,
    deviceId: null,
  } as StoredRow);
}

describe("Item page", () => {
  it("shows today's control, streaks, completion, 7-day bars and a month heatmap", async () => {
    const today = todayLocalDate();
    const steps = seedSteps(addDays(today, -4));
    log(steps, addDays(today, -4), 12000);
    log(steps, addDays(today, -3), 4000);
    log(steps, addDays(today, -2), 10000);
    log(steps, addDays(today, -1), 10500);
    params = new URLSearchParams({ id: steps.id });
    render(
      <AddSheetProvider>
        <ItemViewPage />
      </AddSheetProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Steps" })).toBeInTheDocument();
    const stats = screen.getByRole("region", { name: "Stats" });
    expect(within(stats).getByText("2 days")).toBeInTheDocument(); // current streak
    expect(within(stats).getByText("75%")).toBeInTheDocument(); // 3 of 4 past days
    expect(screen.getByRole("img", { name: "Steps, last 7 days" })).toBeInTheDocument();
    const history = screen.getByRole("region", { name: "History" });
    const cell = (d: string) => history.querySelector(`[aria-label^="${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))}"]`);
    // The month on screen holds today; earlier days may be in the previous month.
    if (addDays(today, -1).slice(0, 7) === today.slice(0, 7)) expect(cell(addDays(today, -1))).toHaveAttribute("data-mark", "done");
    expect(cell(today)).toHaveAttribute("data-mark", "today");
    expect(screen.getByText("Walk after Asr.")).toBeInTheDocument();

    // Log from the item page: +500 increments today's count.
    fireEvent.click(within(screen.getByRole("region", { name: "Today" })).getByRole("button", { name: "Increase Steps by 500" }));
    await waitFor(() => expect(store.query("occurrences", `WHERE "date" = ?`, [today])[0]).toMatchObject({ value: 500 }));
  });

  it("archives and restores, keeping history", async () => {
    const today = todayLocalDate();
    const steps = seedSteps(addDays(today, -2));
    log(steps, addDays(today, -1), 10000);
    params = new URLSearchParams({ id: steps.id });
    render(
      <AddSheetProvider>
        <ItemViewPage />
      </AddSheetProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
    expect(await screen.findByText("Archived — not scheduled.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Stats" })).getByText("Best").nextSibling).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(screen.queryByText("Archived — not scheduled.")).not.toBeInTheDocument());
  });
});
