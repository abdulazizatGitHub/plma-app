import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DEFAULT_REMINDER_PROFILES, type Category, type Item, type Reminder, type UserSettings } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationSettingsPage from "@/app/(main)/settings/notifications/page";
import { ItemEditor } from "@/components/items/item-editor";
import { TodayScreen } from "@/components/today/today-screen";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { LocalStore, type StoredRow } from "@/lib/v2/local-store";
import type { PushState } from "@/lib/v2/push";
import { pickTime } from "@/test/time-field";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
let store: LocalStore;
let pushState: PushState = "off";

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: USER, email: "me@example.com" }, getAccessToken: async () => "t" }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store, syncSoon: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/lib/v2/push", () => ({
  usePush: () => ({ state: pushState, busy: false, error: null, turnOn: vi.fn(), turnOff: vi.fn(), sendTest: vi.fn(), upcoming: vi.fn(async () => []), refresh: vi.fn() }),
}));

let SQL: SqlJsStatic;
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const NOW = "2026-10-01T00:00:00.000Z";
const base = () => ({ id: uid(), userId: USER, createdAt: NOW, updatedAt: NOW, deletedAt: null });

function item(over: Partial<Item>): Item {
  return {
    ...base(), categoryId: null, parentId: null, type: "habit", title: "Item", notes: null, priority: "high", isOptional: false,
    tracking: { v: 1, kind: "check" }, schedule: { v: 1, kind: "daily" }, meta: {}, groupGoalId: null, sortOrder: 0, archivedAt: null,
    sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null, ...over,
  };
}
const reminders = () => store.query("reminders") as unknown as Reminder[];
const occurrences = () => store.query("occurrences") as unknown as { itemId: string; detail: Record<string, unknown> | null }[];
const settings = () => store.query("userSettings")[0] as unknown as UserSettings | undefined;

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  store = await LocalStore.open(uid(), { sqlJs: SQL });
  pushState = "off";
});

function editor(it: Item) {
  store.save("items", it as unknown as StoredRow);
  return render(
    <AddSheetProvider>
      <ItemEditor item={it} existingChildren={[]} preset={{}} onSaved={vi.fn()} onCancel={vi.fn()} />
    </AddSheetProvider>,
  );
}

const openMore = (root: HTMLElement) => fireEvent.click(within(root).getByText(/^Repeat( until done)? & snooze$/));

describe("Reminder section in the item editor", () => {
  it("shows the priority default; Custom sets a time on the wheels and repeat/snooze from chips (no typing)", async () => {
    const walk = item({ title: "Walk", schedule: { v: 1, kind: "daily", anchor: { type: "time", time: "07:30" } } });
    editor(walk);
    const region = screen.getByRole("region", { name: "Reminder" });
    const section = within(region);
    expect(section.getByText(/Auto · High: at its time, then every 30 min until done \(up to 1 more\)/)).toBeInTheDocument();
    fireEvent.click(section.getByRole("tab", { name: "Custom" }));
    pickTime("Time", "06:45", region);
    openMore(region);
    fireEvent.click(section.getByRole("button", { name: "Every 15 min" }));
    fireEvent.click(section.getByRole("button", { name: "3 more" }));
    fireEvent.click(within(section.getByRole("group", { name: "Snooze for" })).getByRole("button", { name: "5 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reminders()).toHaveLength(1));
    expect(reminders()[0]).toMatchObject({ itemId: walk.id, enabled: true, trigger: { type: "at", time: "06:45" }, repeatEveryMin: 15, maxRepeats: 3, snoozeMin: 5 });
  });

  it("around a prayer: prayer, before/after and minutes are chips", async () => {
    editor(item({ title: "Tasbih" }));
    const section = within(screen.getByRole("region", { name: "Reminder" }));
    fireEvent.click(section.getByRole("tab", { name: "Custom" }));
    fireEvent.click(section.getByRole("button", { name: "Around a prayer" }));
    fireEvent.click(within(section.getByRole("group", { name: "Prayer" })).getByRole("button", { name: "Asr" }));
    fireEvent.click(within(section.getByRole("group", { name: "Before or after" })).getByRole("button", { name: "After" }));
    fireEvent.click(within(section.getByRole("group", { name: "By" })).getByRole("button", { name: "15 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reminders()[0]).toMatchObject({ trigger: { type: "prayer", prayer: "asr", relation: "after", offsetMin: 15 } }));
  });

  it("repeats on picked days like an alarm", async () => {
    const steps = item({ title: "Steps" });
    editor(steps);
    const section = within(screen.getByRole("region", { name: "Reminder" }));
    fireEvent.click(section.getByRole("tab", { name: "Custom" }));
    fireEvent.click(section.getByRole("button", { name: "Pick days" }));
    const days = within(section.getByRole("group", { name: "Days" }));
    fireEvent.click(days.getByRole("button", { name: "Tue" }));
    fireEvent.click(days.getByRole("button", { name: "Thu" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reminders()[0]).toMatchObject({ itemId: steps.id, days: [1, 3, 5] }));
  });

  it("needs at least one picked day", () => {
    editor(item({ title: "Gym" }));
    const section = within(screen.getByRole("region", { name: "Reminder" }));
    fireEvent.click(section.getByRole("tab", { name: "Custom" }));
    fireEvent.click(section.getByRole("button", { name: "Pick days" }));
    for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri"]) fireEvent.click(within(section.getByRole("group", { name: "Days" })).getByRole("button", { name: d }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("Default removes the custom reminder; Off keeps a silent one", async () => {
    const it1 = item({ title: "Pay rent", priority: "critical" });
    store.save("reminders", {
      ...base(), itemId: it1.id, trigger: { type: "at", time: "09:00" }, repeatEveryMin: null, repeatUntilDone: false, maxRepeats: 0, enabled: true, snoozeMin: null, days: null, nextFireAt: null,
    } as unknown as StoredRow);
    const { unmount } = editor(it1);
    fireEvent.click(within(screen.getByRole("region", { name: "Reminder" })).getByRole("tab", { name: "Off" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reminders()[0].enabled).toBe(false));
    unmount();

    editor(it1);
    fireEvent.click(within(screen.getByRole("region", { name: "Reminder" })).getByRole("tab", { name: "Default" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reminders().every((r) => r.deletedAt)).toBe(true));
  });
});

describe("Reminder settings", () => {
  const page = () =>
    render(
      <AddSheetProvider>
        <NotificationSettingsPage />
      </AddSheetProvider>,
    );

  it("guides iPhone users to install to the Home Screen first", () => {
    pushState = "ios-install";
    page();
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Turn on notifications/ })).not.toBeInTheDocument();
  });

  it("edits a priority's window with chips", async () => {
    page();
    expect(screen.getByText("At its time, every 30 min up to 6 more · snooze 10 min")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit Critical reminders" }));
    fireEvent.click(screen.getByRole("button", { name: "5 min before" }));
    fireEvent.click(screen.getByRole("button", { name: "Every 15 min" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Snooze for" })).getByRole("button", { name: "15 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(settings()?.reminderProfiles.critical).toEqual({ ...DEFAULT_REMINDER_PROFILES.critical, leadMin: 5, repeatEveryMin: 15, snoozeMin: 15 }));
  });

  it("mutes a category and sets quiet hours on the wheels", async () => {
    store.save("categories", {
      ...base(), name: "Work", icon: "briefcase", color: "sky", sortOrder: 0, archivedAt: null, remindersMuted: false, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null,
    } as unknown as StoredRow);
    page();
    fireEvent.click(screen.getByLabelText("Mute Work"));
    await waitFor(() => expect((store.query("categories")[0] as unknown as Category).remindersMuted).toBe(true));
    fireEvent.click(screen.getByLabelText(/Quiet hours/));
    await waitFor(() => expect(settings()).toMatchObject({ quietFrom: "22:00", quietTo: "07:00" }));
    pickTime("Quiet from", "23:00");
    await waitFor(() => expect(settings()).toMatchObject({ quietFrom: "23:00" }));
  });
});

describe("Remind me… from a row's menu", () => {
  // 9 AM in Karachi: the whole day is still ahead.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T04:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const todayScreen = (it: Item) => {
    store.save("items", it as unknown as StoredRow);
    return render(
      <AddSheetProvider>
        <TodayScreen />
      </AddSheetProvider>,
    );
  };
  const open = async (title: string) => {
    fireEvent.click(await screen.findByRole("button", { name: `More actions for ${title}` }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remind me…" }));
    return within(await screen.findByRole("dialog"));
  };
  const dayReminder = (itemId: string) => occurrences().find((o) => o.itemId === itemId)?.detail?.reminder as Record<string, unknown> | undefined;

  it("one tap on a quick pick sets today's reminder and closes; Undo takes it back", async () => {
    const steps = item({ title: "Steps" });
    todayScreen(steps);
    const sheet = await open("Steps");
    fireEvent.click(sheet.getByRole("button", { name: /^In 30 min/ }));
    await waitFor(() => expect(dayReminder(steps.id)).toMatchObject({ enabled: true, trigger: { type: "at" } }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(dayReminder(steps.id)).toBeUndefined());
  });

  it("wheels + Weekdays saves the item's repeating reminder", async () => {
    const read = item({ title: "Read" });
    todayScreen(read);
    const sheet = await open("Read");
    expect(sheet.getByRole("spinbutton", { name: "Hour" })).toBeInTheDocument();
    fireEvent.click(sheet.getByRole("button", { name: "Weekdays" }));
    fireEvent.click(sheet.getByRole("button", { name: /^(Remind me today|Repeat .*) · \d/ }));
    await waitFor(() => expect(reminders()[0]).toMatchObject({ itemId: read.id, enabled: true, days: [1, 2, 3, 4, 5], trigger: { type: "at" } }));
  });

  it("won't set a time that has already passed today (keyboard on the wheel)", async () => {
    todayScreen(item({ title: "Walk" }));
    const sheet = await open("Walk");
    fireEvent.keyDown(sheet.getByRole("spinbutton", { name: "Hour" }), { key: "Home" });
    expect(sheet.getByRole("alert")).toHaveTextContent("already passed today");
    expect(sheet.getByRole("button", { name: /^(Remind me today|Repeat .*) · \d/ })).toBeDisabled();
  });

  it("No reminder today silences just this day", async () => {
    const gym = item({ title: "Gym" });
    todayScreen(gym);
    const sheet = await open("Gym");
    fireEvent.click(sheet.getByRole("button", { name: /No reminder today/ }));
    await waitFor(() => expect(dayReminder(gym.id)).toMatchObject({ enabled: false }));
  });

  it("Move to a date… opens chips and a calendar; one tap moves it", async () => {
    const run = item({ title: "Run" });
    todayScreen(run);
    fireEvent.click(await screen.findByRole("button", { name: "More actions for Run" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to a date…" }));
    const sheet = within(await screen.findByRole("dialog"));
    expect(sheet.getByRole("grid")).toBeInTheDocument();
    fireEvent.click(sheet.getByRole("button", { name: /^Day after/ }));
    await waitFor(() =>
      expect((store.query("occurrences") as unknown as { itemId: string; status: string; movedTo: string | null }[]).find((o) => o.itemId === run.id)).toMatchObject({
        status: "moved",
        movedTo: "2026-10-14",
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

