import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Category, Item } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import CategoriesPage from "@/app/(main)/categories/page";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { TodayScreen } from "@/components/today/today-screen";
import { LocalStore, type StoredRow } from "@/lib/v2/local-store";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
let store: LocalStore;

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: USER, email: "me@example.com" } }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store, syncSoon: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));

let SQL: SqlJsStatic;
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const NOW = new Date().toISOString();
const base = () => ({ id: uid(), userId: USER, createdAt: NOW, updatedAt: NOW, deletedAt: null, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null });

function category(over: Partial<Category>): StoredRow {
  return { ...base(), name: "Cat", icon: "dumbbell", color: "mint", sortOrder: 0, archivedAt: null, ...over } as StoredRow;
}
function item(over: Partial<Item>): StoredRow {
  return {
    ...base(),
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
    sortOrder: 0,
    archivedAt: null,
    ...over,
  } as StoredRow;
}

const categories = () => (store.query("categories", `WHERE "deleted_at" IS NULL ORDER BY "sort_order"`) as unknown as Category[]);
const items = () => store.query("items") as unknown as Item[];
const page = () =>
  render(
    <AddSheetProvider>
      <CategoriesPage />
    </AddSheetProvider>,
  );

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  store = await LocalStore.open(uid(), { sqlJs: SQL });
});

describe("Categories page", () => {
  it("creates a category with a name, icon and colour", async () => {
    page();
    fireEvent.click(await screen.findByRole("button", { name: "New category" }));
    const dialog = screen.getByRole("dialog", { name: "New category" });
    const add = within(dialog).getByRole("button", { name: "Add category" });
    expect(add).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: "Physical" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: "dumbbell" }));
    fireEvent.click(within(dialog).getByRole("radio", { name: "peach" }));
    fireEvent.click(add);
    expect(await screen.findByRole("region", { name: "Physical" })).toBeInTheDocument();
    expect(categories()).toMatchObject([{ name: "Physical", icon: "dumbbell", color: "peach" }]);
  });

  it("reorders with up/down in reorder mode", async () => {
    store.save("categories", category({ name: "A", sortOrder: 0 }));
    store.save("categories", category({ name: "B", sortOrder: 1 }));
    page();
    fireEvent.click(await screen.findByRole("button", { name: "Reorder" }));
    expect(screen.getByRole("button", { name: "Move A up" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move B up" }));
    await waitFor(() => expect(categories().map((c) => c.name)).toEqual(["B", "A"]));
  });

  it("archives a category: hidden with its items, history kept, restorable", async () => {
    const gym = category({ name: "Gym" });
    store.save("categories", gym);
    store.save("items", item({ title: "Squats", categoryId: gym.id }));
    page();
    fireEvent.click(await screen.findByRole("button", { name: "More actions for Gym" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Gym" })).not.toBeInTheDocument());
    expect(items()[0].archivedAt).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Archived · 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByRole("region", { name: "Gym" })).toBeInTheDocument();
    expect(items()[0].archivedAt).toBeNull();
  });

  it("deletes after confirming; items move to No category", async () => {
    const work = category({ name: "Work" });
    store.save("categories", work);
    store.save("items", item({ title: "Inbox zero", categoryId: work.id }));
    page();
    fireEvent.click(await screen.findByRole("button", { name: "More actions for Work" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: /Delete “Work”/ });
    expect(dialog).toHaveTextContent("Its 1 item moves to “No category”");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(categories()).toEqual([]));
    expect(items()[0].categoryId).toBeNull();
    expect(await screen.findByRole("region", { name: "No category" })).toBeInTheDocument();
  });
});

describe("Routines on Today", () => {
  it("ticking every sub-item completes the routine", async () => {
    const gym = item({ type: "group", title: "Gym — Push day" });
    store.save("items", gym);
    for (const [i, title] of ["Bench", "OHP", "Dips"].entries()) store.save("items", item({ title, parentId: gym.id, sortOrder: i }));
    render(
      <AddSheetProvider>
        <TodayScreen />
      </AddSheetProvider>,
    );
    const routine = await screen.findByRole("region", { name: "Gym — Push day" });
    expect(within(routine).getByText("0/3")).toBeInTheDocument();
    for (const title of ["Bench", "OHP", "Dips"]) fireEvent.click(within(routine).getByRole("checkbox", { name: title }));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Done" })).getByText("Gym — Push day")).toBeInTheDocument());
    expect(screen.getByRole("img", { name: /% of today done/ })).toHaveAttribute("data-value", "100");
  });
});
