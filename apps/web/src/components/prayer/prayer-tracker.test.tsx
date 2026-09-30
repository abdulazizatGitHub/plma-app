import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HabitDefinitionDto, HabitLogDto } from "@life/shared";

const refresh = vi.fn();
vi.mock("@/components/providers/app-data-provider", () => ({
  useAppData: () => ({ refresh }),
}));

// Pin "today" to a known Monday so Kahf-visibility assertions are
// deterministic regardless of which day the test suite actually runs on.
vi.mock("@life/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life/shared")>();
  return { ...actual, todayLocalDate: () => "2026-09-28" };
});

vi.mock("@/lib/db/local-db", () => ({
  getLocalDb: vi.fn(async () => ({})),
}));

let mockDefinitions: HabitDefinitionDto[] = [];
let mockLogs: HabitLogDto[] = [];
const saveHabitLogLocally = vi.fn(
  async (
    _habitDefinitionId: string,
    _logDate: string,
    _payload: Record<string, unknown>,
  ) => ({}) as HabitLogDto,
);
const syncWhenOnline = vi.fn(async () => ({ habits: 0, online: true }));

vi.mock("@/lib/sync/sync-engine", () => ({
  getLocalDefinitions: () => mockDefinitions,
  saveHabitLogLocally: (...args: unknown[]) =>
    (saveHabitLogLocally as (...a: unknown[]) => Promise<HabitLogDto>)(...args),
  syncWhenOnline: () => syncWhenOnline(),
}));

vi.mock("@/lib/db/habit-logs-local", () => ({
  getLocalHabitLogs: async () => mockLogs,
}));

const { PrayerTracker } = await import("./prayer-tracker");

const USER_ID = "123e4567-e89b-42d3-a456-556642440000";

function makeDef(id: string, slug: string): HabitDefinitionDto {
  return {
    id,
    userId: USER_ID,
    slug,
    name: slug,
    category: "faith",
    trackingMethod: slug === "prayer" ? "prayer_set" : "boolean",
    frequency: "daily",
    config: {},
    isSystem: true,
    archivedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
  };
}

beforeEach(() => {
  mockDefinitions = [];
  mockLogs = [];
  saveHabitLogLocally.mockClear();
  syncWhenOnline.mockClear();
  refresh.mockClear();
});

describe("PrayerTracker", () => {
  it("shows a waiting message when the prayer habit hasn't synced locally yet", async () => {
    render(<PrayerTracker />);
    await waitFor(() =>
      expect(screen.getByText(/waiting to sync/i)).toBeInTheDocument(),
    );
  });

  it("renders an explicit Prayed button for all five prayers plus the Quran rows", async () => {
    mockDefinitions = [
      makeDef("def-prayer", "prayer"),
      makeDef("def-mulk", "quran-mulk"),
      makeDef("def-kahf", "quran-kahf"),
    ];
    render(<PrayerTracker />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Mark Fajr as prayed" })).toBeInTheDocument(),
    );
    for (const name of ["Fajr", "Zuhr", "Asr", "Maghrib", "Isha"]) {
      expect(screen.getByRole("button", { name: `Mark ${name} as prayed` })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: `Mark ${name} as missed` })).toBeInTheDocument();
    }
    expect(screen.getByText("Surah Mulk")).toBeInTheDocument();
    expect(screen.getByText("Surah Kahf")).toBeInTheDocument();
  });

  it("shows the first pending prayer as Next up", async () => {
    mockDefinitions = [makeDef("def-prayer", "prayer")];
    mockLogs = [
      {
        id: "log-1",
        userId: USER_ID,
        habitDefinitionId: "def-prayer",
        logDate: "2026-09-28",
        payload: {
          prayers: {
            fajr: "completed",
            zuhr: "missed",
            asr: "pending",
            maghrib: "pending",
            isha: "pending",
          },
        },
        deviceId: null,
        createdAt: "2026-09-28T00:00:00.000Z",
        updatedAt: "2026-09-28T00:00:00.000Z",
        deletedAt: null,
      },
    ];
    render(<PrayerTracker />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Mark Asr as prayed (next up)" }),
      ).toBeInTheDocument(),
    );
    // Logged prayers offer Undo instead of Prayed/Missed.
    expect(screen.getByRole("button", { name: "Undo Fajr" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo Zuhr" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Fajr as prayed" })).toBeNull();
  });

  it("clicking Prayed saves `completed` for that prayer only", async () => {
    mockDefinitions = [makeDef("def-prayer", "prayer")];
    const user = userEvent.setup();
    render(<PrayerTracker />);

    const fajrButton = await screen.findByRole("button", { name: "Mark Fajr as prayed" });
    await user.click(fajrButton);

    await waitFor(() => expect(saveHabitLogLocally).toHaveBeenCalledTimes(1));
    const [defId, date, payload] = saveHabitLogLocally.mock.calls[0];
    const prayers = payload.prayers as Record<string, string>;
    expect(defId).toBe("def-prayer");
    expect(date).toBe("2026-09-28");
    expect(prayers.fajr).toBe("completed");
    // The other four prayers stay pending in the same write.
    expect(prayers.zuhr).toBe("pending");
  });

  it("clicking Missed saves `missed`", async () => {
    mockDefinitions = [makeDef("def-prayer", "prayer")];
    const user = userEvent.setup();
    render(<PrayerTracker />);

    await user.click(await screen.findByRole("button", { name: "Mark Isha as missed" }));

    await waitFor(() => expect(saveHabitLogLocally).toHaveBeenCalledTimes(1));
    const prayers = saveHabitLogLocally.mock.calls[0][2].prayers as Record<string, string>;
    expect(prayers.isha).toBe("missed");
  });

  it("locks every prayer control while a save is in flight (no lost updates)", async () => {
    mockDefinitions = [makeDef("def-prayer", "prayer")];
    let release!: () => void;
    saveHabitLogLocally.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve({} as HabitLogDto))),
    );
    const user = userEvent.setup();
    render(<PrayerTracker />);

    await user.click(await screen.findByRole("button", { name: "Mark Fajr as prayed" }));
    // A second prayer written now would be built from stale state and clobber Fajr.
    expect(screen.getByRole("button", { name: "Mark Zuhr as prayed" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark Isha as missed" })).toBeDisabled();

    release();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Mark Zuhr as prayed" })).toBeEnabled(),
    );
  });

  it("disables the Kahf action on a non-Friday and says Fridays only", async () => {
    mockDefinitions = [makeDef("def-prayer", "prayer"), makeDef("def-kahf", "quran-kahf")];
    render(<PrayerTracker />);

    const kahfButton = await screen.findByRole("button", { name: /mark surah kahf as read/i });
    expect(kahfButton).toBeDisabled();
    expect(kahfButton).toHaveTextContent(/fridays only/i);
  });
});
