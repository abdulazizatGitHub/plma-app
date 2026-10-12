import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildDay, createPrayerSet, prayerKeyOf, todayLocalDate, type Item, type Occurrence } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays } from "@/components/kit";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { LocalStore, type StoredRow } from "@/lib/v2/local-store";
import { PrayerGroup } from "./prayer-group";
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

beforeAll(async () => {
  SQL = await initSqlJs();
});
/** 9 PM in Karachi on Mon 12 Oct 2026: every prayer has started, Isha is now. */
const NINE_PM = new Date("2026-10-12T16:00:00Z");
afterEach(() => vi.useRealTimers());
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NINE_PM);
  store = await LocalStore.open(uid(), { sqlJs: SQL });
  const changes = createPrayerSet({ userId: USER, now: "2026-01-01T00:00:00.000Z", deviceId: null }, uid, { categoryId: null });
  for (const c of changes) store.save(c.entity, c.row as unknown as StoredRow);
});

const prayers = () => store.query("items", `WHERE "parent_id" IS NOT NULL`) as unknown as Item[];
const occs = () => store.query("occurrences") as unknown as Occurrence[];
const occOf = (key: string) => occs().find((o) => o.itemId === prayers().find((p) => prayerKeyOf(p) === key)?.id);

const today = () =>
  render(
    <AddSheetProvider>
      <TodayScreen />
    </AddSheetProvider>,
  );

describe("Prayer block on Today", () => {
  it("shows each prayer's time and what's next; approximate until a location is set", async () => {
    today();
    const block = await screen.findByRole("region", { name: "Daily prayers" });
    // Time passed but not marked: neutral, never assumed qada or missed.
    expect(within(block).getByRole("button", { name: /^Fajr, time passed, not marked, \d{1,2}:\d{2} (AM|PM)/ })).toBeInTheDocument();
    expect(within(block).getByRole("button", { name: /^Isha, not marked, .*, now$/ })).toBeInTheDocument();
    expect(within(block).getByText(/^Isha now · until \d{1,2}:\d{2} AM tomorrow · best before/)).toBeInTheDocument();
    expect(within(block).getByText("Times are approximate (Karachi).")).toBeInTheDocument();
  });

  it("tapping a prayer whose time passed marks it on time (marked later); 'Prayed late?' switches it to qada", async () => {
    today();
    const block = await screen.findByRole("region", { name: "Daily prayers" });
    fireEvent.click(within(block).getByRole("button", { name: /^Asr, time passed/ }));
    await waitFor(() => expect(occOf("asr")?.status).toBe("done"));
    expect(occOf("asr")?.detail?.qada).toBeUndefined();
    fireEvent.click(await screen.findByRole("button", { name: "Prayed late?" }));
    await waitFor(() => expect(occOf("asr")).toMatchObject({ status: "done", detail: { qada: true } }));
  });

  it("'All on time' marks every started prayer, for people who mark at night", async () => {
    today();
    await screen.findByRole("region", { name: "Daily prayers" });
    fireEvent.click(screen.getByRole("button", { name: "Mark prayers" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "All on time" }));
    await waitFor(() => expect(occs().filter((o) => o.status === "done" && !o.detail?.qada)).toHaveLength(5));
  });

  it("after midnight, yesterday's Isha carries over and is marked on time", async () => {
    vi.setSystemTime(new Date("2026-10-12T21:00:00Z")); // 2 AM Tue in Karachi
    today();
    const row = await screen.findByRole("region", { name: "Isha from Mon" });
    expect(within(row).getByText(/still on time until \d{1,2}:\d{2} AM/)).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Prayed" }));
    await waitFor(() => expect(occOf("isha")).toMatchObject({ status: "done", date: "2026-10-12" }));
    expect(occOf("isha")?.detail?.qada).toBeUndefined();
    await waitFor(() => expect(screen.queryByRole("region", { name: "Isha from Mon" })).not.toBeInTheDocument());
  });

  it("any order: Asr prayed, then Fajr marked qada from its hold menu; both count", async () => {
    today();
    const block = await screen.findByRole("region", { name: "Daily prayers" });
    fireEvent.click(within(block).getByRole("button", { name: /^Asr, time passed/ }));
    await waitFor(() => expect(occOf("asr")?.status).toBe("done"));
    fireEvent.contextMenu(within(block).getByRole("button", { name: /^Fajr, time passed/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Prayed late (qada)" }));
    await waitFor(() => expect(occOf("fajr")).toMatchObject({ status: "done", detail: { qada: true } }));
    expect(within(block).getByRole("img", { name: "2 of 5 prayers prayed" })).toBeInTheDocument();
    expect(within(block).getByRole("button", { name: /^Fajr, prayed late \(qada\)/ })).toBeInTheDocument();
  });

  it("the ⋯ sheet sets every prayer explicitly (visible twin of hold)", async () => {
    today();
    fireEvent.click(await screen.findByRole("button", { name: "More actions for Daily prayers" }));
    const sheet = screen.getByRole("dialog");
    fireEvent.click(within(within(sheet).getByRole("group", { name: "Isha status" })).getByRole("button", { name: "Missed" }));
    await waitFor(() => expect(occOf("isha")?.status).toBe("missed"));
  });

  it("yesterday (closed): unmarked prayers read as missed, and tapping one recovers it as qada", async () => {
    today();
    const yesterday = addDays(todayLocalDate(), -1);
    const label = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${yesterday}T12:00:00`));
    await screen.findByRole("region", { name: "Daily prayers" });
    if (!screen.queryByRole("button", { name: new RegExp(`^${label}`) })) fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    const block = await screen.findByRole("region", { name: "Daily prayers" });
    await waitFor(() => expect(within(block).getByRole("button", { name: /^Maghrib, missed/ })).toBeInTheDocument());
    expect(within(block).getByText(/tap one to recover it as qada/)).toBeInTheDocument();
    fireEvent.click(within(block).getByRole("button", { name: /^Maghrib, missed/ }));
    await waitFor(() => expect(occOf("maghrib")).toMatchObject({ status: "done", detail: { qada: true }, date: yesterday }));
  });

  it("future prayers can't be marked yet", async () => {
    const t = todayLocalDate();
    const tomorrow = addDays(t, 1);
    const entry = buildDay(store.query("items") as unknown as Item[], [], tomorrow)[0];
    render(
      <AddSheetProvider>
        <PrayerGroup entry={entry} date={tomorrow} />
      </AddSheetProvider>,
    );
    expect(screen.getByText("Upcoming — mark them on the day")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Fajr, upcoming/ }));
    await new Promise((r) => setTimeout(r, 50));
    expect(occs()).toHaveLength(0);
  });

  it("on Fridays Zuhr reads Jumu'ah (and can be turned off)", () => {
    const friday = "2026-10-09";
    const entry = buildDay(store.query("items") as unknown as Item[], [], friday)[0];
    const { unmount } = render(
      <AddSheetProvider>
        <PrayerGroup entry={entry} date={friday} />
      </AddSheetProvider>,
    );
    expect(screen.getByRole("button", { name: /^Jumu'ah,/ })).toBeInTheDocument();
    unmount();
    store.save("userSettings", { id: USER, userId: USER, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null, timezone: "Asia/Karachi", weekStart: 1, lat: null, lng: null, locationLabel: null, calcMethod: "karachi", madhab: "hanafi", prayerOffsets: {}, dayParts: [], prayerManual: {}, jumuahLabel: false, locationMode: "unset", quietFrom: null, quietTo: null, visibility: "friends" });
    render(
      <AddSheetProvider>
        <PrayerGroup entry={entry} date={friday} />
      </AddSheetProvider>,
    );
    expect(screen.getByRole("button", { name: /^Zuhr,/ })).toBeInTheDocument();
  });
});
