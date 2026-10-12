import "fake-indexeddb/auto";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { UserSettings } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pickTime } from "@/test/time-field";
import PrayerSettingsPage from "@/app/(main)/settings/prayer/page";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { decideLocation } from "@/lib/location/access";
import { labelFor, nearestCity } from "@/lib/location/cities";
import { LocalStore } from "@/lib/v2/local-store";
import { LocationProvider, useLocation } from "./location-provider";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
let store: LocalStore;

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: USER, email: "me@example.com" } }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store, syncSoon: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));

let SQL: SqlJsStatic;
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
let permission: PermissionState = "prompt";
const getCurrentPosition = vi.fn();

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  store = await LocalStore.open(uid(), { sqlJs: SQL });
  permission = "prompt";
  getCurrentPosition.mockReset();
  Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: () => Promise.resolve({ state: permission }) } });
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
});
afterEach(() => vi.restoreAllMocks());

const settings = () => store.query("userSettings")[0] as unknown as UserSettings | undefined;
const fixAt = (lat: number, lng: number) => getCurrentPosition.mockImplementation((ok: PositionCallback) => ok({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition));

describe("decideLocation (owner rules)", () => {
  const cases: [Parameters<typeof decideLocation>[1], Parameters<typeof decideLocation>[0], ReturnType<typeof decideLocation>][] = [
    [{ mode: "unset", permission: "prompt", level: null }, "whileUsing", "ask"],
    [{ mode: "device", permission: "granted", level: "whileUsing" }, "whileUsing", "use"], // covered → never ask again
    [{ mode: "device", permission: "granted", level: "whileUsing" }, "always", "upgrade"], // needs more → ask again
    [{ mode: "device", permission: "prompt", level: "whileUsing" }, "whileUsing", "ask"], // reset in the browser
    [{ mode: "never", permission: "prompt", level: null }, "whileUsing", "fallback"], // Never is respected
    [{ mode: "city", permission: "granted", level: null }, "whileUsing", "fallback"],
    [{ mode: "device", permission: "denied", level: "whileUsing" }, "whileUsing", "fallback"],
  ];
  it.each(cases)("%o needing %s → %s", (state, required, expected) => expect(decideLocation(required, state)).toBe(expected));

  it("names a fix by the nearest bundled city", () => {
    expect(nearestCity({ lat: 31.52, lng: 74.36 }).city.name).toBe("Lahore");
    expect(labelFor({ lat: 29.0, lng: 66.0 })).toMatch(/^Near /);
  });
});

function Feature({ required = "whileUsing" as const }: { required?: "whileUsing" | "always" }) {
  const { ensure } = useLocation();
  return (
    <button type="button" onClick={() => void ensure(required, "Prayer times are calculated for where you are.")}>
      Need location
    </button>
  );
}
const renderFeature = (required?: "whileUsing" | "always") =>
  render(
    <AddSheetProvider>
      <LocationProvider>
        <Feature required={required} />
      </LocationProvider>
    </AddSheetProvider>,
  );

describe("LocationProvider", () => {
  it("asks once, with Always / While using / city / Never; While using saves a rounded fix", async () => {
    fixAt(31.5546, 74.3572);
    renderFeature();
    fireEvent.click(screen.getByRole("button", { name: "Need location" }));
    const sheet = await screen.findByRole("dialog", { name: "Use your location?" });
    expect(within(sheet).getByRole("button", { name: /Always/ })).toBeDisabled();
    fireEvent.click(within(sheet).getByRole("button", { name: /While using the app/ }));
    await waitFor(() => expect(settings()).toMatchObject({ lat: 31.55, lng: 74.36, locationLabel: "Lahore", locationMode: "device" }));
    expect(store.getMeta("location_level")).toBe("whileUsing");

    // Already covered: no sheet the second time.
    permission = "granted";
    getCurrentPosition.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Need location" }));
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: "Use your location?" })).not.toBeInTheDocument();
  });

  it("a feature needing Always re-asks with an upgrade sheet", async () => {
    store.save("userSettings", { id: USER, userId: USER, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", deletedAt: null, timezone: "Asia/Karachi", weekStart: 1, lat: 24.86, lng: 67.01, locationLabel: "Karachi", calcMethod: "karachi", madhab: "hanafi", prayerOffsets: {}, dayParts: [], prayerManual: {}, jumuahLabel: true, locationMode: "device", quietFrom: null, quietTo: null, visibility: "friends" });
    store.setMeta("location_level", "whileUsing");
    permission = "granted";
    renderFeature("always");
    fireEvent.click(screen.getByRole("button", { name: "Need location" }));
    expect(await screen.findByRole("dialog", { name: "Allow location all the time?" })).toHaveTextContent("Life phone app");
  });

  it("Choose a city works without GPS; Never is remembered and not asked again", async () => {
    renderFeature();
    fireEvent.click(screen.getByRole("button", { name: "Need location" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Choose a city instead/ }));
    fireEvent.change(screen.getByPlaceholderText(/Search a city/), { target: { value: "pesh" } });
    fireEvent.click(screen.getByRole("button", { name: /Peshawar/ }));
    await waitFor(() => expect(settings()).toMatchObject({ locationLabel: "Peshawar", locationMode: "city", timezone: "Asia/Karachi" }));
    fireEvent.click(screen.getByRole("button", { name: "Need location" }));
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocked in the browser → explains and offers a city", async () => {
    getCurrentPosition.mockImplementation((_ok: PositionCallback, fail: PositionErrorCallback) => fail({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3 } as GeolocationPositionError));
    renderFeature();
    fireEvent.click(screen.getByRole("button", { name: "Need location" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /While using the app/ }));
    expect(await screen.findByRole("dialog", { name: "Location is blocked" })).toBeInTheDocument();
  });
});

describe("Prayer settings page", () => {
  const page = () =>
    render(
      <AddSheetProvider>
        <LocationProvider>
          <PrayerSettingsPage />
        </LocationProvider>
      </AddSheetProvider>,
    );

  it("shows approximate times, saves method, Asr, offsets and fixed times", async () => {
    page();
    expect(await screen.findByText(/Approximate — Karachi/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Method" }), { target: { value: "mwl" } });
    fireEvent.click(screen.getByRole("tab", { name: "Shafi'i / others" }));
    fireEvent.click(screen.getByRole("button", { name: "Maghrib one minute later" }));
    await waitFor(() => expect(settings()).toMatchObject({ calcMethod: "mwl", madhab: "shafi", prayerOffsets: { maghrib: 1 } }));
    pickTime("Isha fixed time", "20:30");
    await waitFor(() => expect(settings()?.prayerManual).toEqual({ isha: "20:30" }));
    expect(within(screen.getByRole("list", { name: "Today's prayer times" })).getByText("8:30 PM")).toBeInTheDocument();
  });

  it("adds the prayer block, then edits it (add Tahajjud)", async () => {
    page();
    fireEvent.click(await screen.findByRole("button", { name: /Add daily prayers/ }));
    await screen.findByRole("button", { name: "Save prayers" });
    fireEvent.click(screen.getByRole("button", { name: /Tahajjud/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save prayers" }));
    await waitFor(() => expect((store.query("items") as unknown as { title: string }[]).map((i) => i.title)).toContain("Tahajjud"));
  });
});
