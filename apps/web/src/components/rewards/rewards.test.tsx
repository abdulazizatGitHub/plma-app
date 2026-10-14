import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { RewardsPayload } from "@life/shared";
import { describe, expect, it, vi } from "vitest";
import { RewardsLine, RewardsPanel, streakNote } from "./rewards-panel";

const markSeen = vi.fn(async () => {});
let current: RewardsPayload | null = null;
vi.mock("@/lib/v2/use-rewards", () => ({ useRewards: () => ({ rewards: current, refresh: vi.fn(), markSeen }) }));
vi.mock("@/lib/v2/use-today", () => ({ useToday: () => "2026-10-14" }));
let dayView: { entries: unknown[]; progress: { required: number; done: number; pct: number; counts: object }; ready: boolean } = {
  entries: [],
  progress: { required: 0, done: 0, pct: 100, counts: {} },
  ready: true,
};
vi.mock("@/lib/v2/use-day", () => ({ useDay: () => dayView }));
const notify = vi.fn();
vi.mock("@/components/providers/add-sheet-provider", () => ({ useAddSheet: () => ({ notify }) }));

const base: RewardsPayload = {
  points: 1240,
  level: 5,
  levelStart: 1000,
  nextLevelAt: 1500,
  todayPoints: 12,
  weekPoints: 86,
  today: "2026-10-14",
  streak: { current: 9, best: 12, freezes: 1, freezeUsedOn: ["2026-10-10"], restartedAfter: [], provisional: 1 },
  badges: [
    { id: "streak_3", earnedAt: "2026-09-20T10:00:00.000Z", seen: true },
    { id: "streak_7", earnedAt: "2026-10-01T10:00:00.000Z", seen: false },
  ],
  progress: [
    { id: "streak_30", earned: false, have: 9, need: 30 },
    { id: "first_plan", earned: false },
  ],
};

describe("Rewards on Progress", () => {
  it("shows level, points, streak with freezes and badges (locked ones with how far along)", () => {
    render(<RewardsPanel rewards={base} />);
    const panel = screen.getByRole("region", { name: "Rewards" });
    expect(within(panel).getByText("1,240 points")).toBeInTheDocument();
    expect(within(panel).getByText(/260 to level 6/)).toBeInTheDocument();
    expect(within(panel).getByRole("img", { name: "Level 5: 240 of 500 points to level 6" })).toBeInTheDocument();
    expect(within(panel).getByLabelText("7-day streak: earned 1 Oct")).toBeInTheDocument();
    expect(within(panel).getByLabelText("30-day streak: locked, 21 more days")).toBeInTheDocument();
    expect(within(panel).getByLabelText("First plan finished: locked, Finish a plan")).toBeInTheDocument();
    expect(within(panel).getByText(/A freeze covered 10 Oct — your 9-day streak keeps going/)).toBeInTheDocument();
  });

  it("a restart is gentle: never 'lost', the best is kept", () => {
    const r = { ...base, streak: { ...base.streak, current: 0, freezeUsedOn: [], restartedAfter: ["2026-10-12"] } };
    expect(streakNote(r)).toBe("A new streak starts today — your best is still 12.");
    expect(streakNote({ ...base, streak: { ...base.streak, freezeUsedOn: [] } })).toBeNull();
  });

  it("before the first sync it says so instead of showing zeros", () => {
    render(<RewardsPanel rewards={null} />);
    expect(screen.getByText(/appear after your first sync/)).toBeInTheDocument();
  });

  it("Today's line is one quiet row", () => {
    render(<RewardsLine rewards={base} />);
    expect(screen.getByLabelText("Rewards")).toHaveTextContent("Level 5 · 1,240 pts9-day streak1 freeze+12 today");
  });
});

describe("Celebrations", () => {
  it("a new badge gets its own card once; closing it marks it seen", async () => {
    current = base;
    const { Celebrations } = await import("./celebrations");
    render(<Celebrations />);
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("7-day streak")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Nice" }));
    expect(markSeen).toHaveBeenCalledWith(["streak_7"]);
  });

  it("finishing the day with a tap: '+3', confetti and 'Perfect day — +10'", async () => {
    current = { ...base, badges: [] };
    const { Celebrations } = await import("./celebrations");
    const entry = (done: boolean) => ({
      key: "k",
      item: { id: "i", priority: "high", isOptional: false, tracking: { v: 1, kind: "check" }, schedule: { v: 1, kind: "daily" }, meta: {} },
      slot: "",
      occurrence: done ? { id: "o", status: "done", value: null, detail: null } : null,
    });
    dayView = { entries: [entry(false)], progress: { required: 1, done: 0, pct: 0, counts: {} }, ready: true };
    const { container, rerender } = render(<Celebrations />);
    act(() => void window.dispatchEvent(new PointerEvent("pointerdown", { clientX: 100, clientY: 200 })));
    dayView = { entries: [entry(true)], progress: { required: 1, done: 1, pct: 100, counts: {} }, ready: true };
    rerender(<Celebrations />);
    expect(container.querySelector(".points-pop")).toHaveTextContent("+3");
    expect(container.querySelectorAll(".confetti-piece").length).toBeGreaterThan(0);
    expect(notify).toHaveBeenCalledWith({ message: "Perfect day — +10 bonus" });
  });
});

