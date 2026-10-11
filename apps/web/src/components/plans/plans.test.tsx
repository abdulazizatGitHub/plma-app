import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Item, ItemDependency } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import PlansPage from "@/app/(main)/plans/page";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { LocalStore } from "@/lib/v2/local-store";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
let store: LocalStore;
let params = new URLSearchParams();
const push = vi.fn();

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: USER, email: "me@example.com" } }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store, syncSoon: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }), useSearchParams: () => params }));
vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));

let SQL: SqlJsStatic;
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  store = await LocalStore.open(uid(), { sqlJs: SQL });
  params = new URLSearchParams();
  push.mockReset();
});

const items = () => store.query("items", `WHERE "deleted_at" IS NULL`) as unknown as Item[];
const deps = () => store.query("itemDependencies", `WHERE "deleted_at" IS NULL`) as unknown as ItemDependency[];
const page = () =>
  render(
    <AddSheetProvider>
      <PlansPage />
    </AddSheetProvider>,
  );

describe("Plans page", () => {
  it("creates a content collab with its four steps and Post waiting for Payment", async () => {
    page();
    fireEvent.click((await screen.findAllByRole("button", { name: /New plan/ }))[0]);
    const sheet = screen.getByRole("dialog", { name: "New plan" });
    expect(within(sheet).getByRole("radio", { name: /Content collab/ })).toHaveAttribute("aria-checked", "true");
    expect(within(sheet).getByRole("button", { name: "Create plan" })).toBeDisabled();
    fireEvent.change(within(sheet).getByLabelText(/^Plan name/), { target: { value: "Collab — Café X" } });
    fireEvent.change(within(sheet).getByLabelText("Venue"), { target: { value: "Café X" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Create plan" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/plans\/view\?id=/)));
    const plan = items().find((i) => i.type === "plan")!;
    expect(plan).toMatchObject({ title: "Collab — Café X", meta: { preset: "collab", venue: "Café X" } });
    expect(items().filter((i) => i.parentId === plan.id).map((i) => i.title).sort()).toEqual(["Edit", "Payment cleared", "Post", "Shoot"]);
    expect(deps()).toHaveLength(1);
    expect(await screen.findByRole("link", { name: "Collab — Café X" })).toHaveTextContent(/Next: Shoot · no date yet/);
  });

  it("a university course needs its course; the plan takes the course as its name", async () => {
    params = new URLSearchParams({ new: "1" }); // opened from + → New plan
    page();
    const sheet = await screen.findByRole("dialog", { name: "New plan" });
    fireEvent.click(within(sheet).getByRole("radio", { name: /University course/ }));
    const create = within(sheet).getByRole("button", { name: "Create plan" });
    expect(create).toBeDisabled();
    fireEvent.change(within(sheet).getByLabelText(/^Course/), { target: { value: "DSA" } });
    expect(create).toBeEnabled();
    fireEvent.click(create);
    await waitFor(() => expect(items().find((i) => i.type === "plan")).toMatchObject({ title: "DSA", meta: { preset: "university", course: "DSA" } }));
  });
});
