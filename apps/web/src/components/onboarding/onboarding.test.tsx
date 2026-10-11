import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { STARTER_PACKS, type Category, type Item } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import WelcomePage from "@/app/(main)/welcome/page";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { LocalStore } from "@/lib/v2/local-store";
import { ONBOARDED_KEY, OnboardingGate, TOUR_KEY } from "./onboarding-gate";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
let store: LocalStore;
let lastResult: { ok: boolean } | null = null;
let params = new URLSearchParams();
const replace = vi.fn();

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: USER, email: "me@example.com" } }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store, lastResult, syncSoon: vi.fn() }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn() }),
  useSearchParams: () => params,
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));

let SQL: SqlJsStatic;
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const categories = () => store.query("categories", `WHERE "deleted_at" IS NULL ORDER BY "sort_order"`) as unknown as Category[];

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  store = await LocalStore.open(uid(), { sqlJs: SQL });
  replace.mockReset();
  params = new URLSearchParams();
});

describe("OnboardingGate", () => {
  it("sends a new, empty account to /welcome after the first successful sync", () => {
    lastResult = null;
    const { rerender } = render(<OnboardingGate />);
    expect(replace).not.toHaveBeenCalled();
    lastResult = { ok: false };
    rerender(<OnboardingGate />);
    expect(replace).not.toHaveBeenCalled(); // offline: might be an existing account on a new device
    lastResult = { ok: true };
    rerender(<OnboardingGate />);
    expect(replace).toHaveBeenCalledWith("/welcome");
  });

  it("leaves existing accounts alone and remembers that", () => {
    lastResult = { ok: true };
    store.save("categories", {
      id: uid(),
      userId: USER,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      deletedAt: null,
      name: "Mine",
      icon: "tag",
      color: "sky",
      sortOrder: 0,
      archivedAt: null,
      sourceTemplateId: null,
      sourceTemplateVersion: null,
      adoptedAt: null,
    });
    render(<OnboardingGate />);
    expect(replace).not.toHaveBeenCalled();
    expect(store.getMeta(ONBOARDED_KEY)).toBe("existing");
  });
});

describe("Welcome (two-step setup)", () => {
  const renderWelcome = () =>
    render(
      <AddSheetProvider>
        <WelcomePage />
      </AddSheetProvider>,
    );
  const items = () => store.query("items", `WHERE "deleted_at" IS NULL`) as unknown as Item[];

  it("interests become categories; only ticked suggestions are added, with edited targets", async () => {
    renderWelcome();
    expect(await screen.findByRole("button", { name: "Pick at least one interest" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Spiritual/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Physical/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next — 2 interests" }));

    // Step 2: nothing is pre-ticked.
    expect(screen.getAllByRole("checkbox").every((c) => c.getAttribute("aria-checked") === "false")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /^Steps/ }));
    const target = screen.getByLabelText("Steps target");
    expect(target).toHaveValue("10000");
    fireEvent.change(target, { target: { value: "6k000" } });
    expect(target).toHaveValue("6000");
    fireEvent.click(screen.getByRole("button", { name: "Finish — add 1 item" }));

    await waitFor(() => expect(categories().map((c) => c.name)).toEqual(["Spiritual", "Physical"]));
    expect(items()).toHaveLength(1);
    expect(items()[0]).toMatchObject({ title: "Steps", tracking: { target: 6000 }, sourceTemplateId: STARTER_PACKS[1].id });
    expect(store.getMeta(ONBOARDED_KEY)).toBe("packs");
    expect(store.getMeta(TOUR_KEY)).toBe("pending");
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("a routine suggestion brings its sub-items; an empty target blocks Finish", async () => {
    renderWelcome();
    fireEvent.click(await screen.findByRole("button", { name: /^Physical/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next — 1 interest" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^Gym — Push day/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^Steps/ }));
    fireEvent.change(screen.getByLabelText("Steps target"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Finish — add 2 items" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Steps target"), { target: { value: "8000" } });
    fireEvent.click(screen.getByRole("button", { name: "Finish — add 2 items" }));
    await waitFor(() => expect(items().filter((i) => i.parentId)).toHaveLength(5));
  });

  it("Skip creates nothing but still offers the tour", async () => {
    renderWelcome();
    fireEvent.click(await screen.findByRole("button", { name: "Skip — start empty" }));
    expect(categories()).toEqual([]);
    expect(store.getMeta(ONBOARDED_KEY)).toBe("empty");
    expect(store.getMeta(TOUR_KEY)).toBe("pending");
  });

  it("from Categories, offers only interests not set up yet", async () => {
    params = new URLSearchParams({ add: "1" });
    renderWelcome();
    fireEvent.click(await screen.findByRole("button", { name: /^Work/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next — 1 interest" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^Plan the day/ }));
    fireEvent.click(screen.getByRole("button", { name: "Finish — add 1 item" }));
    await waitFor(() => expect(categories().map((c) => c.name)).toEqual(["Work"]));
    expect(replace).toHaveBeenCalledWith("/categories");
    expect(store.getMeta(TOUR_KEY)).toBeNull();
  });
});

