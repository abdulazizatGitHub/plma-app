import "fake-indexeddb/auto";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Item } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
const NOW = "2026-01-01T00:00:00.000Z";

function item(over: Partial<Item>): StoredRow {
  return {
    id: uid(), userId: USER, createdAt: NOW, updatedAt: NOW, deletedAt: null, categoryId: null, parentId: null, type: "habit", title: "Item", notes: null,
    priority: "medium", isOptional: false, tracking: { v: 1, kind: "check" }, schedule: { v: 1, kind: "daily" }, meta: {}, groupGoalId: null, sortOrder: 0,
    archivedAt: null, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null, ...over,
  } as StoredRow;
}

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  store = await LocalStore.open(uid(), { sqlJs: SQL });
  try {
    localStorage.removeItem("life_today_view");
  } catch {
    /* ignore */
  }
});

describe("Prayer anchors and the Day view", () => {
  it("tags anchored items with their window and groups the day by prayer-based parts", async () => {
    store.save("items", item({ title: "Surah Mulk", schedule: { v: 1, kind: "daily", anchor: { type: "prayer", prayer: "isha", relation: "after", offsetMin: 0 } } }));
    store.save("items", item({ title: "Morning walk", schedule: { v: 1, kind: "daily", anchor: { type: "time", time: "07:30" } } }));
    store.save("items", item({ title: "Read", sortOrder: 1 }));
    render(
      <AddSheetProvider>
        <TodayScreen />
      </AddSheetProvider>,
    );
    expect(await screen.findByText(/^After Isha · \d/)).toBeInTheDocument();
    // Status view sorts by time of day: walk (7:30) before Mulk (after Isha), untimed last.
    const todo = within(screen.getByRole("region", { name: "To Do" }));
    const titles = todo.getAllByText(/^(Morning walk|Surah Mulk|Read)$/).map((el) => el.textContent);
    expect(titles).toEqual(["Morning walk", "Surah Mulk", "Read"]);

    fireEvent.click(screen.getByRole("tab", { name: "By time of day" }));
    expect(within(screen.getByRole("region", { name: "Night" })).getByText("Surah Mulk")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Anytime" })).getByText("Read")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Morning|After Fajr/ })).toHaveTextContent("Morning walk");
    expect(localStorage.getItem("life_today_view")).toBe("day");
  });
});
