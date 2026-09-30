import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HabitDefinitionDto, HabitLogDto } from "@life/shared";

const TODAY = "2026-09-28";

const refresh = vi.fn();
vi.mock("@/components/providers/app-data-provider", () => ({
  useAppData: () => ({ refresh }),
}));

vi.mock("@life/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life/shared")>();
  return { ...actual, todayLocalDate: () => TODAY };
});

vi.mock("@/lib/db/local-db", () => ({ getLocalDb: vi.fn(async () => ({})) }));

let mockDefinitions: HabitDefinitionDto[] = [];
let mockLogs: HabitLogDto[] = [];
const saveHabitLogLocally = vi.fn(async () => ({}) as HabitLogDto);
const updateLocalDefinitionConfig = vi.fn(async () => ({}) as HabitDefinitionDto);

vi.mock("@/lib/sync/sync-engine", () => ({
  getLocalDefinitions: () => mockDefinitions,
  saveHabitLogLocally: (...args: unknown[]) =>
    (saveHabitLogLocally as (...a: unknown[]) => Promise<HabitLogDto>)(...args),
  updateLocalDefinitionConfig: (...args: unknown[]) =>
    (updateLocalDefinitionConfig as (...a: unknown[]) => Promise<HabitDefinitionDto>)(...args),
  syncWhenOnline: async () => ({ habits: 0, online: true }),
}));

vi.mock("@/lib/db/habit-logs-local", () => ({ getLocalHabitLogs: async () => mockLogs }));

const { HealthTracker } = await import("./health-tracker");

const USER_ID = "123e4567-e89b-42d3-a456-556642440000";

function makeDef(id: string, slug: string, config: Record<string, unknown> = {}): HabitDefinitionDto {
  return {
    id,
    userId: USER_ID,
    slug,
    name: slug,
    category: "health",
    trackingMethod: "counter",
    frequency: "daily",
    config,
    isSystem: true,
    archivedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
  };
}

function makeLog(habitDefinitionId: string, logDate: string, payload: Record<string, unknown>): HabitLogDto {
  return {
    id: `${habitDefinitionId}-${logDate}`,
    userId: USER_ID,
    habitDefinitionId,
    logDate,
    payload,
    deviceId: null,
    createdAt: "2026-09-28T00:00:00.000Z",
    updatedAt: "2026-09-28T00:00:00.000Z",
    deletedAt: null,
  };
}

const STEPS = makeDef("def-steps", "steps", { goal: 10000 });
const WATER = makeDef("def-water", "water", { goal: 8 });
const EXERCISE = makeDef("def-exercise", "exercise");
const SLEEP = makeDef("def-sleep", "sleep", { wakeGoal: "06:00" });
const ALL = [STEPS, WATER, EXERCISE, SLEEP];

/** Scopes queries to one Health section (sections are anchored by id for /health#sleep links). */
function section(id: string) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`section #${id} not rendered`);
  return within(el);
}

beforeEach(() => {
  mockDefinitions = [];
  mockLogs = [];
  saveHabitLogLocally.mockClear();
  updateLocalDefinitionConfig.mockClear();
  refresh.mockClear();
});

describe("HealthTracker", () => {
  it("shows a waiting message before any health habit has synced", async () => {
    render(<HealthTracker />);
    expect(await screen.findByText(/waiting to sync/i)).toBeInTheDocument();
  });

  it("renders the four sections once definitions load", async () => {
    mockDefinitions = ALL;
    render(<HealthTracker />);
    for (const title of ["Steps", "Water", "Exercise", "Sleep"]) {
      expect(await screen.findByRole("heading", { name: new RegExp(title, "i") })).toBeInTheDocument();
    }
  });

  it("displays water as 6/8 and tapping a glass sets that count", async () => {
    mockDefinitions = ALL;
    mockLogs = [makeLog(WATER.id, TODAY, { value: 6 })];
    const user = userEvent.setup();
    render(<HealthTracker />);

    await screen.findByRole("heading", { name: /water/i });
    const water = section("water");
    // The headline numeral reads "6/8".
    expect(
      water.getByText((_, el) => el?.tagName === "P" && el.textContent === "6/8"),
    ).toBeInTheDocument();
    // Glasses 1–6 are filled, 7–8 empty.
    expect(water.getAllByRole("button", { name: /^glass \d of 8$/i, pressed: true })).toHaveLength(6);
    expect(water.getAllByRole("button", { name: /^glass \d of 8$/i, pressed: false })).toHaveLength(2);

    await user.click(water.getByRole("button", { name: "Glass 8 of 8" }));
    await waitFor(() =>
      expect(saveHabitLogLocally).toHaveBeenCalledWith(WATER.id, TODAY, { value: 8 }),
    );
  });

  it("gives every glass a unique name, and tapping the last filled one empties it", async () => {
    mockDefinitions = ALL;
    mockLogs = [makeLog(WATER.id, TODAY, { value: 3 })];
    const user = userEvent.setup();
    render(<HealthTracker />);

    await screen.findByRole("heading", { name: /water/i });
    const water = section("water");
    const names = water
      .getAllByRole("button", { name: /^glass \d of 8$/i })
      .map((b) => b.getAttribute("aria-label"));
    expect(new Set(names).size).toBe(names.length);

    await user.click(water.getByRole("button", { name: "Glass 3 of 8" }));
    await waitFor(() =>
      expect(saveHabitLogLocally).toHaveBeenCalledWith(WATER.id, TODAY, { value: 2 }),
    );
  });

  it("saves a manually entered step total, and rejects invalid input", async () => {
    mockDefinitions = ALL;
    const user = userEvent.setup();
    render(<HealthTracker />);

    await screen.findByRole("heading", { name: /steps/i });
    const steps = section("steps");
    const input = steps.getByRole("spinbutton", { name: /set today's total/i });

    // Empty, then over the maximum — both rejected without writing.
    await user.click(steps.getByRole("button", { name: /^save$/i }));
    expect(steps.getByText(/whole number/i)).toBeInTheDocument();
    await user.type(input, "300000");
    await user.click(steps.getByRole("button", { name: /^save$/i }));
    expect(steps.getByText(/whole number/i)).toBeInTheDocument();
    expect(saveHabitLogLocally).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, "8500");
    await user.click(steps.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(saveHabitLogLocally).toHaveBeenCalledWith(STEPS.id, TODAY, { value: 8500 }),
    );
  });

  it("quick-adds steps on top of today's count", async () => {
    mockDefinitions = ALL;
    mockLogs = [makeLog(STEPS.id, TODAY, { value: 4000 })];
    const user = userEvent.setup();
    render(<HealthTracker />);

    await screen.findByRole("heading", { name: /steps/i });
    await user.click(section("steps").getByRole("button", { name: "Add 1,000 steps" }));
    await waitFor(() =>
      expect(saveHabitLogLocally).toHaveBeenCalledWith(STEPS.id, TODAY, { value: 5000 }),
    );
  });

  it("edits the steps goal through the definition config", async () => {
    mockDefinitions = ALL;
    const user = userEvent.setup();
    render(<HealthTracker />);

    await screen.findByRole("heading", { name: /steps/i });
    const steps = section("steps");
    await user.click(steps.getByRole("button", { name: /edit daily goal/i }));
    const goalInput = steps.getByRole("spinbutton", { name: "Daily goal" });
    await user.clear(goalInput);
    await user.type(goalInput, "12000");
    await user.click(steps.getByRole("button", { name: /save daily goal/i }));

    await waitFor(() =>
      expect(updateLocalDefinitionConfig).toHaveBeenCalledWith(STEPS.id, { goal: 12000 }),
    );
  });

  it("saves an exercise with type and duration", async () => {
    mockDefinitions = ALL;
    const user = userEvent.setup();
    render(<HealthTracker />);

    await screen.findByRole("heading", { name: /exercise/i });
    const exercise = section("exercise");
    await user.click(exercise.getByRole("button", { name: "Run" }));
    await user.click(exercise.getByRole("button", { name: "45 minutes" }));
    await user.click(exercise.getByRole("button", { name: /save workout/i }));

    await waitFor(() =>
      expect(saveHabitLogLocally).toHaveBeenCalledWith(EXERCISE.id, TODAY, {
        completed: true,
        durationMinutes: 45,
        type: "run",
      }),
    );
  });

  it("saves last night's sleep as UTC instants on today's (wake-up) date", async () => {
    mockDefinitions = ALL;
    const user = userEvent.setup();
    render(<HealthTracker />);

    await screen.findByRole("heading", { name: /sleep/i });
    const sleep = section("sleep");
    const bed = sleep.getByLabelText(/bedtime/i);
    const wake = sleep.getByLabelText(/woke up/i);
    await user.clear(bed);
    await user.type(bed, "23:10");
    await user.clear(wake);
    await user.type(wake, "06:05");
    await user.click(sleep.getByRole("button", { name: /save sleep/i }));

    await waitFor(() => expect(saveHabitLogLocally).toHaveBeenCalledTimes(1));
    const [defId, date, payload] = saveHabitLogLocally.mock.calls[0] as unknown as [
      string,
      string,
      { bedAt: string; wakeAt: string },
    ];
    expect(defId).toBe(SLEEP.id);
    expect(date).toBe(TODAY);
    expect(payload.bedAt).toBe(new Date(2026, 8, 27, 23, 10).toISOString());
    expect(payload.wakeAt).toBe(new Date(2026, 8, 28, 6, 5).toISOString());
  });

  it("shows a logged night with its wake-goal badge", async () => {
    mockDefinitions = ALL;
    mockLogs = [
      makeLog(SLEEP.id, TODAY, {
        bedAt: new Date(2026, 8, 27, 23, 0).toISOString(),
        wakeAt: new Date(2026, 8, 28, 6, 30).toISOString(),
      }),
    ];
    render(<HealthTracker />);

    await screen.findByRole("heading", { name: /sleep/i });
    const sleep = section("sleep");
    // Shown as the headline and again as this week's average (one night).
    expect(sleep.getAllByText("7h 30m")).toHaveLength(2);
    expect(sleep.getByText("After 06:00")).toBeInTheDocument();
    expect(sleep.getByRole("button", { name: /update sleep/i })).toBeInTheDocument();
  });
});
