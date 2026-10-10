import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { STARTER_PACKS, type Category, type Item } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import WelcomePage from "@/app/(main)/welcome/page";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { LocalStore } from "@/lib/v2/local-store";
import { ONBOARDED_KEY, OnboardingGate } from "./onboarding-gate";

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

describe("Welcome", () => {
  const renderWelcome = () =>
    render(
      <AddSheetProvider>
        <WelcomePage />
      </AddSheetProvider>,
    );

  it("adds only the two packs picked, then never asks again", async () => {
    renderWelcome();
    const start = await screen.findByRole("button", { name: "Pick at least one pack" });
    expect(start).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Spiritual/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Physical/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start with 2 packs" }));
    await waitFor(() => expect(categories().map((c) => c.name)).toEqual(["Spiritual", "Physical"]));
    const items = store.query("items") as unknown as Item[];
    expect(items.some((i) => i.title === "Gym — Push day")).toBe(true);
    expect(items.every((i) => [STARTER_PACKS[0].id, STARTER_PACKS[1].id].includes(i.sourceTemplateId ?? ""))).toBe(true);
    expect(store.getMeta(ONBOARDED_KEY)).toBe("packs");
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("Start empty creates nothing", async () => {
    renderWelcome();
    fireEvent.click(await screen.findByRole("button", { name: "Start empty" }));
    expect(categories()).toEqual([]);
    expect(store.getMeta(ONBOARDED_KEY)).toBe("empty");
  });

  it("from Categories, offers only packs not added yet", async () => {
    params = new URLSearchParams({ add: "1" });
    renderWelcome();
    fireEvent.click(await screen.findByRole("button", { name: /^Work/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 pack" }));
    await waitFor(() => expect(categories().map((c) => c.name)).toEqual(["Work"]));
    expect(screen.queryByRole("button", { name: /^Work/ })).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/categories");
  });
});
