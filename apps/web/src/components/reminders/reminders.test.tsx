import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DEFAULT_REMINDER_PROFILES, type Category, type Item, type Reminder, type UserSettings } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationSettingsPage from "@/app/(main)/settings/notifications/page";
import { ItemEditor } from "@/components/items/item-editor";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { LocalStore, type StoredRow } from "@/lib/v2/local-store";
import type { PushState } from "@/lib/v2/push";

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
const NOW = new Date().toISOString();
const base = () => ({ id: uid(), userId: USER, createdAt: NOW, updatedAt: NOW, deletedAt: null });

function item(over: Partial<Item>): Item {
  return {
    ...base(), categoryId: null, parentId: null, type: "habit", title: "Item", notes: null, priority: "high", isOptional: false,
    tracking: { v: 1, kind: "check" }, schedule: { v: 1, kind: "daily" }, meta: {}, groupGoalId: null, sortOrder: 0, archivedAt: null,
    sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null, ...over,
  };
}
const reminders = () => store.query("reminders") as unknown as Reminder[];
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

describe("Reminder section in the item editor", () => {
  it("shows the priority's auto reminder, and a custom one replaces it with its own repeat and snooze", async () => {
    const walk = item({ title: "Walk", schedule: { v: 1, kind: "daily", anchor: { type: "time", time: "07:30" } } });
    editor(walk);
    const section = within(screen.getByRole("region", { name: "Reminder" }));
    expect(section.getByText(/Auto · High: at its time, then every 30 min until done \(up to 1 more\)/)).toBeInTheDocument();

    fireEvent.click(section.getByRole("tab", { name: "Custom" }));
    fireEvent.change(section.getByLabelText("Time"), { target: { value: "06:45" } });
    fireEvent.change(section.getByLabelText("Every (minutes)"), { target: { value: "15" } });
    fireEvent.change(section.getByLabelText("Up to (more times)"), { target: { value: "2" } });
    fireEvent.change(section.getByLabelText(/Snooze for/), { target: { value: "5x" } });
    expect((section.getByLabelText(/Snooze for/) as HTMLInputElement).value).toBe("5");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reminders()).toHaveLength(1));
    expect(reminders()[0]).toMatchObject({ itemId: walk.id, enabled: true, trigger: { type: "at", time: "06:45" }, repeatEveryMin: 15, maxRepeats: 2, snoozeMin: 5 });
  });

  it("blocks saving an invalid custom reminder", () => {
    editor(item({ title: "Read" }));
    const section = within(screen.getByRole("region", { name: "Reminder" }));
    fireEvent.click(section.getByRole("tab", { name: "Custom" }));
    fireEvent.change(section.getByLabelText("Every (minutes)"), { target: { value: "2" } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("Back to auto removes the custom reminder; Off keeps a silent one", async () => {
    const it1 = item({ title: "Pay rent", priority: "critical" });
    store.save("reminders", { ...base(), itemId: it1.id, trigger: { type: "at", time: "09:00" }, repeatEveryMin: null, repeatUntilDone: false, maxRepeats: 0, enabled: true, snoozeMin: null, nextFireAt: null } as unknown as StoredRow);
    const { unmount } = editor(it1);
    fireEvent.click(within(screen.getByRole("region", { name: "Reminder" })).getByRole("tab", { name: "Off" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reminders()[0].enabled).toBe(false));
    unmount();

    editor(it1);
    fireEvent.click(within(screen.getByRole("region", { name: "Reminder" })).getByRole("tab", { name: "Auto" }));
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

  it("edits a priority's window with validated numbers", async () => {
    page();
    expect(screen.getByText("At its time, every 30 min up to 6 more · snooze 10 min")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit Critical reminders" }));
    const every = screen.getByLabelText("Every (minutes)");
    fireEvent.change(every, { target: { value: "1" } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(every, { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/Snooze for/), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(settings()?.reminderProfiles.critical).toEqual({ ...DEFAULT_REMINDER_PROFILES.critical, repeatEveryMin: 20, snoozeMin: 15 }));
  });

  it("mutes a category and sets quiet hours", async () => {
    store.save("categories", { ...base(), name: "Work", icon: "briefcase", color: "sky", sortOrder: 0, archivedAt: null, remindersMuted: false, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null } as unknown as StoredRow);
    page();
    fireEvent.click(screen.getByLabelText("Mute Work"));
    await waitFor(() => expect((store.query("categories")[0] as unknown as Category).remindersMuted).toBe(true));
    fireEvent.click(screen.getByLabelText(/Quiet hours/));
    await waitFor(() => expect(settings()).toMatchObject({ quietFrom: "22:00", quietTo: "07:00" }));
  });
});
