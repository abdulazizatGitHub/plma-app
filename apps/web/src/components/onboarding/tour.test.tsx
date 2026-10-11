import "fake-indexeddb/auto";
import { fireEvent, render, screen } from "@testing-library/react";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { TodayScreen } from "@/components/today/today-screen";
import { LocalStore } from "@/lib/v2/local-store";
import { TOUR_KEY } from "./onboarding-gate";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
let store: LocalStore;

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: USER, email: "me@example.com" } }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store, syncSoon: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));

let SQL: SqlJsStatic;
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  store = await LocalStore.open(uid(), { sqlJs: SQL });
  // jsdom has no layout; give every element a box so tour targets count as visible.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(16, 100, 200, 48));
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

const today = () =>
  render(
    <AddSheetProvider>
      <TodayScreen />
    </AddSheetProvider>,
  );

describe("First-run tour", () => {
  it("walks through the steps once and is marked done", async () => {
    store.setMeta(TOUR_KEY, "pending");
    const { unmount } = today();
    const tour = await screen.findByRole("dialog", { name: "App tour" });
    expect(tour).toHaveTextContent("1 of 3"); // ring, tiles, list (the navs aren't rendered here)
    expect(tour).toHaveTextContent("Your day at a glance");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(tour).toHaveTextContent("To Do · In Progress · Done");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(tour).toHaveTextContent("Your day at a glance");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog", { name: "App tour" })).not.toBeInTheDocument();
    expect(store.getMeta(TOUR_KEY)).toBe("done");
    unmount();
    today();
    await screen.findByText(/Nothing planned/);
    expect(screen.queryByRole("dialog", { name: "App tour" })).not.toBeInTheDocument();
  });

  it("can be skipped", async () => {
    store.setMeta(TOUR_KEY, "pending");
    today();
    fireEvent.click(await screen.findByRole("button", { name: "Skip tour" }));
    expect(store.getMeta(TOUR_KEY)).toBe("done");
  });

  it("does not show without a pending flag", async () => {
    today();
    await screen.findByText(/Nothing planned/);
    expect(screen.queryByRole("dialog", { name: "App tour" })).not.toBeInTheDocument();
  });
});
