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
vi.mock("@/lib/v2/use-day", () => ({ useDay: () => dayView, useUserSettings: () => ({ timezone: "Asia/Karachi", dayEndHour: 0 }) }));
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
  awards: [
    { id: "streak_30", earned: false, have: 9, need: 30 },
    { id: "prayers_100", earned: false, have: 63, need: 100 },
    { id: "first_plan", earned: false },
    { id: "challenge:2026-10", earned: false, have: 9, need: 22, live: true },
  ],
  week: [],
  challenge: { month: "2026-10", ring: "prayer", target: 22, closed: 9, daysLeft: 17 },
  hijriOffset: 0,
};

describe("Rewards on Progress", () => {
  it("leads with the monthly challenge, then streak, awards (in season first), and points last", () => {
    render(<RewardsPanel rewards={base} />);
    const panel = screen.getByRole("region", { name: "Rewards" });
    expect(within(panel).getByText("Close your Prayer ring 22 days in October")).toBeInTheDocument();
    expect(within(panel).getByText("13 more Prayer rings · 17 days left")).toBeInTheDocument();
    expect(within(panel).getByText(/A freeze covered 10 Oct — your 9-day streak keeps going/)).toBeInTheDocument();
    const tiles = within(panel).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"));
    expect(tiles).toEqual(["October 2026 challenge: locked, 13 more days", "7-day streak: earned 1 Oct", "3-day streak: earned 20 Sept", "100 prayers: locked, 63 of 100"]);
    expect(within(panel).getByRole("link", { name: /All awards/ })).toHaveAttribute("href", "/progress/awards");
    expect(within(panel).getByText(/260 to level 6/)).toBeInTheDocument();
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
    expect(screen.getByLabelText("Rewards")).toHaveTextContent("9-day streak1 freezeLevel 5 · 1,240 pts · +12 today");
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

  it("closing every ring with a tap: '+3', confetti and 'perfect day, +10'", async () => {
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
    expect(notify).toHaveBeenCalledWith({ message: "Every ring closed — perfect day, +10" });
  });
});

