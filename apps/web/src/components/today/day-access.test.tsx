import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildDay, dayAccess, todayLocalDate, type Item } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays } from "@/components/kit";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { LocalStore, type StoredRow } from "@/lib/v2/local-store";
import { EntryRow } from "./entry-row";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
let store: LocalStore;

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: USER, email: "me@example.com" } }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store, syncSoon: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));

let SQL: SqlJsStatic;
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const NOW = "2026-01-01T00:00:00.000Z";

function habit(over: Partial<Item>): Item {
  return {
    id: uid(), userId: USER, createdAt: NOW, updatedAt: NOW, deletedAt: null, categoryId: null, parentId: null, type: "habit", title: "Habit", notes: null,
    priority: "medium", isOptional: false, tracking: { v: 1, kind: "check" }, schedule: { v: 1, kind: "daily" }, meta: {}, groupGoalId: null, sortOrder: 0,
    archivedAt: null, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null, ...over,
  } as Item;
}

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  store = await LocalStore.open(uid(), { sqlJs: SQL });
});

function row(item: Item, date: string) {
  store.save("items", item as unknown as StoredRow);
  const entry = buildDay([item], store.query("occurrences") as never, date)[0];
  return render(
    <AddSheetProvider>
      <EntryRow entry={entry} date={date} onMore={vi.fn()} />
    </AddSheetProvider>,
  );
}

describe("day access (daily items belong to their day)", () => {
  const today = todayLocalDate();

  it("classifies days", () => {
    expect(dayAccess(today, today)).toBe("live");
    expect(dayAccess(addDays(today, -1), today)).toBe("late");
    expect(dayAccess(addDays(today, -2), today)).toBe("history");
    expect(dayAccess(addDays(today, 1), today)).toBe("planned");
  });

  it("older days are history: the habit shows Missed and can't be ticked", async () => {
    row(habit({ title: "Gym" }), addDays(today, -3));
    expect(screen.getByText("Missed")).toBeInTheDocument();
    const check = screen.getByRole("checkbox", { name: "Gym" });
    expect(check).toBeDisabled();
    fireEvent.click(check);
    await new Promise((r) => setTimeout(r, 50));
    expect(store.query("occurrences")).toHaveLength(0);
  });

  it("future days are for planning: no ticking, no stepper", () => {
    row(habit({ title: "Steps", tracking: { v: 1, kind: "quantity", unit: "steps", target: 10000, step: 500 } }), addDays(today, 1));
    expect(screen.getByRole("checkbox", { name: "Steps" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Increase Steps by 500" })).not.toBeInTheDocument();
  });

  it("yesterday can still be logged (forgot to record it)", async () => {
    row(habit({ title: "Vitamins" }), addDays(today, -1));
    fireEvent.click(screen.getByRole("checkbox", { name: "Vitamins" }));
    await waitFor(() => expect(store.query("occurrences")).toHaveLength(1));
  });
});

describe("goals", () => {
  it("a reached goal folds its stepper; Log more brings it back and extra counts", async () => {
    const today = todayLocalDate();
    const item = habit({ title: "Pages", tracking: { v: 1, kind: "quantity", unit: "pages", target: 2, step: 1 } });
    store.save("items", item as unknown as StoredRow);
    store.save("occurrences", {
      id: uid(), userId: USER, createdAt: NOW, updatedAt: NOW, deletedAt: null, itemId: item.id, date: today, slot: "", status: "done", value: 4,
      detail: null, movedTo: null, movedFrom: null, startedAt: null, completedAt: NOW, deviceId: null,
    } as StoredRow);
    const entry = buildDay([item], store.query("occurrences") as never, today)[0];
    render(
      <AddSheetProvider>
        <EntryRow entry={entry} date={today} onMore={vi.fn()} />
      </AddSheetProvider>,
    );
    expect(screen.getByText(/Goal reached · 4 pages/)).toBeInTheDocument();
    expect(screen.getByText("+2 over")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Increase Pages by 1" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Log more" }));
    expect(within(screen.getByRole("checkbox", { name: "Pages" }).closest(".card") as HTMLElement).getByRole("button", { name: "Increase Pages by 1" })).toBeInTheDocument();
  });
});
