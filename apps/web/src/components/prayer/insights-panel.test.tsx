import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createPrayerSet, prayerKeyOf, todayLocalDate, type Item, type Occurrence } from "@life/shared";
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

describe("Prayer insights page", () => {
  it("shows insights and recovers a missed prayer as qada", async () => {
    const today = todayLocalDate();
    const yesterday = addDays(today, -1);
    const created = `${addDays(today, -2)}T00:00:00.000Z`;
    for (const c of createPrayerSet({ userId: USER, now: created, deviceId: null }, uid, { categoryId: null })) store.save(c.entity, c.row as unknown as StoredRow);
    const items = store.query("items") as unknown as Item[];
    const group = items.find((i) => i.meta.prayerSet)!;
    const byKey = (k: string) => items.find((i) => prayerKeyOf(i) === k)!;
    // Yesterday: everything prayed except Fajr (left unmarked → missed).
    for (const k of ["dhuhr", "asr", "maghrib", "isha"]) {
      store.save("occurrences", {
        id: uid(), userId: USER, createdAt: created, updatedAt: created, deletedAt: null, itemId: byKey(k).id, date: yesterday, slot: "",
        status: "done", value: null, detail: null, movedTo: null, movedFrom: null, startedAt: null, completedAt: null, deviceId: null,
      } as unknown as StoredRow);
    }
    params = new URLSearchParams({ id: group.id });
    render(
      <AddSheetProvider>
        <ItemViewPage />
      </AddSheetProvider>,
    );
    const panel = await screen.findByRole("region", { name: "Prayer insights" });
    // "This week" may hold only today (e.g. on a Monday); the month covers the sample days unless the month just began.
    if (addDays(today, -2).slice(0, 7) === today.slice(0, 7)) {
      fireEvent.click(within(panel).getByRole("tab", { name: "This month" }));
      expect(within(panel).getAllByText(/Fajr is your most missed prayer|Most missed/).length).toBeGreaterThan(0);
    }
    const missed = within(panel).getByRole("region", { name: "Missed prayers" });
    // Day before yesterday (all unmarked) plus yesterday's Fajr.
    expect(within(missed).getAllByRole("button", { name: "Mark as qada" })).toHaveLength(6);
    const fajrYesterday = within(missed).getAllByRole("listitem").find((li) => li.textContent?.startsWith("Fajr") && li.textContent.includes(new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${yesterday}T12:00:00`)).replace(",", "")))!;
    fireEvent.click(within(fajrYesterday).getByRole("button", { name: "Mark as qada" }));
    await waitFor(() => expect(within(missed).getAllByRole("button", { name: "Mark as qada" })).toHaveLength(5));
    const occ = (store.query("occurrences") as unknown as Occurrence[]).find((o) => o.itemId === byKey("fajr").id && o.date === yesterday);
    expect(occ).toMatchObject({ status: "done", detail: { qada: true } });
  });
});
