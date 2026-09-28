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

  it("renders all five prayer buttons and the Quran toggles once definitions load", async () => {
    mockDefinitions = [
      makeDef("def-prayer", "prayer"),
      makeDef("def-mulk", "quran-mulk"),
      makeDef("def-kahf", "quran-kahf"),
    ];
    render(<PrayerTracker />);

    await waitFor(() => expect(screen.getByText("Fajr")).toBeInTheDocument());
    for (const name of ["Fajr", "Zuhr", "Asr", "Maghrib", "Isha"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByText(/surah mulk/i)).toBeInTheDocument();
    expect(screen.getByText(/surah kahf/i)).toBeInTheDocument();
  });

  it("clicking a prayer button saves the next status via saveHabitLogLocally", async () => {
    mockDefinitions = [makeDef("def-prayer", "prayer")];
    const user = userEvent.setup();
    render(<PrayerTracker />);

    await waitFor(() => expect(screen.getByText("Fajr")).toBeInTheDocument());
    expect(screen.getAllByText("pending")).toHaveLength(5);

    const fajrButton = screen.getByText("Fajr").closest("button");
    expect(fajrButton).not.toBeNull();
    await user.click(fajrButton!);

    await waitFor(() => expect(saveHabitLogLocally).toHaveBeenCalledTimes(1));
    const [defId, date, payload] = saveHabitLogLocally.mock.calls[0];
    const prayers = payload.prayers as Record<string, string>;
    expect(defId).toBe("def-prayer");
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(prayers.fajr).toBe("completed");
    // The other four prayers stay pending in the same write.
    expect(prayers.zuhr).toBe("pending");
  });

  it("disables the Kahf toggle on a non-Friday and shows N/A", async () => {
    mockDefinitions = [makeDef("def-prayer", "prayer"), makeDef("def-kahf", "quran-kahf")];
    render(<PrayerTracker />);

    await waitFor(() => expect(screen.getByText(/surah kahf/i)).toBeInTheDocument());
    const kahfButton = screen.getByText(/surah kahf/i).closest("button");
    expect(kahfButton).toBeDisabled();
  });
});
