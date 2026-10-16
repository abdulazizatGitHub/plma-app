import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ActivityPayload, FriendsPayload, LeaderboardPayload } from "@life/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { path: string; body?: unknown; method?: string }[] = [];
let responses: Record<string, unknown> = {};
const notify = vi.fn();
let me: { username: string | null; displayName: string | null } | null = { username: "ali", displayName: "Ali" };

const fakeApi = async (path: string, init: { method?: string; body?: unknown } = {}) => {
  calls.push({ path, ...init });
  const key = Object.keys(responses).find((k) => path.startsWith(k));
  return key ? { ok: true, data: responses[key] } : { ok: false, status: 404, code: "not_found", message: "Nope" };
};
// Stable like the real hook (a new function each render would refetch forever).
vi.mock("@/lib/v2/api", () => ({ API_BASE: "http://api", useApi: () => fakeApi }));
vi.mock("@/components/providers/add-sheet-provider", () => ({ useAddSheet: () => ({ notify }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store: { getMeta: () => null, setMeta: () => {} } }) }));
const stable = { setMe: vi.fn(), refreshMe: vi.fn(), refreshUnread: vi.fn() };
vi.mock("@/lib/v2/use-social", () => ({ useSocial: () => ({ me, unread: 0, ...stable }), PENDING_INVITE: "k" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));

const person = (id: string, name: string) => ({ id, name, username: name.toLowerCase(), avatarColor: "mint" as const });
const streak = (count: number, atRisk = false) => ({ count, best: count, today: { me: false, them: false }, atRisk, endsAt: count ? "2026-10-17T00:00:00+05:00" : null, endedAt: null });
const friends: FriendsPayload = {
  friends: [
    { ...person("00000000-0000-4000-8000-000000000001", "Sara"), progress: { weekPoints: 120, monthPoints: 400, level: 3, streak: 5 }, since: "2026-10-01T00:00:00Z", streak: streak(12, true), last: null },
    { ...person("00000000-0000-4000-8000-000000000002", "Omar"), progress: null, since: "2026-10-01T00:00:00Z", streak: streak(0), last: null },
  ],
  incoming: [],
  outgoing: [],
  blocked: [],
};

beforeEach(() => {
  calls.length = 0;
  notify.mockReset();
  me = { username: "ali", displayName: "Ali" };
  responses = { "/v1/friends": friends, "/v1/shares": { id: "s1" } };
});

describe("Share sheet", () => {
  it("the snap sheet shows each friend's 🔥 (⌛ when it ends soon)", async () => {
    const { ShareSheet } = await import("./share-sheet");
    render(<ShareSheet what={{ kind: "day", label: "today's rings" }} onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog", { name: "Snap today's rings" });
    expect(await within(dialog).findByLabelText(/^12-day snap streak, ends in/)).toBeInTheDocument();
  });

  it("send stays disabled until a friend is picked; sends only the chosen ones", async () => {
    const { ShareSheet } = await import("./share-sheet");
    const onClose = vi.fn();
    render(<ShareSheet what={{ kind: "item_streak", itemId: "00000000-0000-4000-8000-0000000000aa", label: "your Fajr streak" }} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "Snap your Fajr streak" });
    expect(within(dialog).getByRole("button", { name: "Pick who gets it" })).toBeDisabled();
    fireEvent.click(await within(dialog).findByRole("checkbox", { name: /Sara/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Send to 1" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls.find((c) => c.path === "/v1/shares")?.body).toEqual({ kind: "item_streak", itemId: "00000000-0000-4000-8000-0000000000aa", awardId: undefined, date: undefined, recipients: [friends.friends[0].id] });
    expect(notify).toHaveBeenCalledWith({ message: "Snapped Sara" });
  });

  it("asks for a username first", async () => {
    me = { username: null, displayName: "Ali" };
    const { ShareSheet } = await import("./share-sheet");
    render(<ShareSheet what={{ kind: "streak", label: "your streak" }} onClose={vi.fn()} />);
    expect(await screen.findByRole("dialog", { name: "Choose your username" })).toBeInTheDocument();
  });
});

describe("Leaderboard", () => {
  it("names, avatars and points only; medals for the top three; you're highlighted", async () => {
    const board: LeaderboardPayload = {
      board: "friends",
      period: "week",
      from: "2026-10-12",
      to: "2026-10-18",
      rows: [
        { ...person("a", "Sara"), rank: 1, points: 120, you: false },
        { ...person("b", "Ali"), rank: 2, points: 90, you: true },
      ],
      you: null,
      hidden: false,
    };
    responses["/v1/leaderboard"] = board;
    const { Leaderboard } = await import("./leaderboard");
    render(<Leaderboard period="week" />);
    const list = await screen.findByRole("list", { name: "Friends this week" });
    expect(within(list).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"))).toEqual(["1. Sara, 120 points", "2. Ali (you), 90 points"]);
    expect(calls.some((c) => c.path === "/v1/leaderboard?board=friends&period=week")).toBe(true);
  });
});

describe("Snaps (Activity)", () => {
  it("a new snap opens once full-screen, with Kudos and Snap back; then it reads 'Opened'", async () => {
    const act: ActivityPayload = {
      entries: [
        { type: "share", id: "s1", at: new Date(Date.now() - 5 * 60_000).toISOString(), from: person("a", "Sara"), kind: "item_streak", payload: { kind: "item_streak", title: "Fajr", current: 21, best: 21, prayer: true }, opened: false, kudosSent: false, seen: false },
        { type: "kudos", id: "k1", at: "2026-10-15T08:00:00Z", from: person("b", "Omar"), share: { kind: "streak", current: 9, best: 12 }, seen: true },
      ],
      unread: 1,
    };
    responses["/v1/activity"] = act;
    responses["/v1/snaps/s1/open"] = { opened: false, payload: act.entries[0].type === "share" ? act.entries[0].payload : null };
    responses["/v1/shares/s1/kudos"] = { ok: true };
    const { default: ActivityPage } = await import("@/app/(main)/activity/page");
    render(<ActivityPage />);
    fireEvent.click(await screen.findByRole("button", { name: "New snap from Sara, 5m" }));
    const viewer = await screen.findByRole("dialog", { name: "Snap from Sara" });
    expect(await within(viewer).findByText("Sara shared a 21-day Fajr streak")).toBeInTheDocument();
    fireEvent.click(within(viewer).getByRole("button", { name: /Kudos/ }));
    expect(within(viewer).getByRole("button", { name: /Kudos sent/ })).toBeDisabled();
    fireEvent.click(within(viewer).getByRole("button", { name: /Snap back/ }));
    await waitFor(() => expect(calls.some((c) => c.path === "/v1/shares" && JSON.stringify(c.body) === JSON.stringify({ kind: "day", recipients: ["a"] }))).toBe(true));
    fireEvent.click(within(viewer).getByRole("button", { name: "Close" }));
    expect(await screen.findByRole("button", { name: "Opened snap from Sara, 5m" })).toBeDisabled();
    expect(screen.getByText("On your 9-day streak")).toBeInTheDocument();
    expect(calls.filter((c) => c.path === "/v1/shares/s1/kudos")).toHaveLength(1);
    expect(calls.some((c) => c.path === "/v1/activity/seen")).toBe(true);
  });
});
