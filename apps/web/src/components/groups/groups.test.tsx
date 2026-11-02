import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { GroupDetail } from "@life/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { path: string; body?: unknown }[] = [];
let responses: Record<string, unknown> = {};
const notify = vi.fn();
const fakeApi = async (path: string, init: { method?: string; body?: unknown } = {}) => {
  calls.push({ path, body: init.body });
  const key = Object.keys(responses).find((k) => path.startsWith(k));
  return key ? { ok: true, data: responses[key] } : { ok: false, status: 404, code: "not_found", message: "Nope" };
};
vi.mock("@/lib/v2/api", () => ({ API_BASE: "http://api", useApi: () => fakeApi }));
vi.mock("@/components/providers/add-sheet-provider", () => ({ useAddSheet: () => ({ notify }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store: { getMeta: () => null, setMeta: () => {} } }) }));
const social = { me: { id: "me", username: "me", displayName: "Me" }, unread: 0, setMe: vi.fn(), refreshMe: vi.fn(), refreshUnread: vi.fn(), openSnap: vi.fn() };
vi.mock("@/lib/v2/use-social", () => ({ useSocial: () => social, PENDING_GROUP_INVITE: "g" }));
vi.mock("@/lib/v2/use-today", () => ({ useToday: () => "2026-10-14" }));
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams("id=g1") }));

const person = (id: string, name: string) => ({ id, name, username: name.toLowerCase(), avatarColor: "mint" as const });
const streak = { count: 3, best: 3, todayDone: false, snappedToday: 1, atRisk: false };
const detail: GroupDetail = {
  id: "g1",
  name: "Family",
  icon: "home",
  color: "mint",
  role: "owner",
  members: [person("me", "Me"), person("b", "Bilal")],
  memberCount: 2,
  streak,
  goal: null,
  visibility: "members",
  roles: { me: "owner", b: "member" },
  goals: [
    {
      id: "goal1",
      title: "70k steps",
      mode: "each",
      tracking: "quantity",
      unit: "steps",
      target: 70000,
      from: "2026-10-14",
      to: "2026-10-18",
      reward: "Winner picks the dinner",
      members: [
        { ...person("me", "Me"), value: 72000, met: true },
        { ...person("b", "Bilal"), value: 31000, met: false },
      ],
      total: 1,
      met: false,
      daysLeft: 4,
      finished: false,
    },
  ],
  snappedToday: [person("b", "Bilal")],
  inviteCode: null,
};

beforeEach(() => {
  calls.length = 0;
  notify.mockReset();
  responses = { "/v1/groups/g1/snaps": { ...detail, snappedToday: [person("b", "Bilal"), person("me", "Me")], streak: { ...streak, todayDone: true, snappedToday: 2 } }, "/v1/groups/g1": detail };
});

describe("Group page", () => {
  it("shows each member's progress on a goal, the reward, roles and the streak", async () => {
    const { default: GroupPage } = await import("@/app/(main)/groups/view/page");
    render(<GroupPage />);
    const goal = await screen.findByRole("region", { name: "70k steps" });
    const rows = within(within(goal).getByRole("list", { name: "70k steps progress" })).getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toEqual(["MYou72,000 / 70,000 steps", "BBilal31,000 / 70,000 steps"]); // avatar initials, then name and amount
    expect(within(goal).getByText("Winner picks the dinner")).toBeInTheDocument();
    expect(screen.getByLabelText("3-day group streak")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Members" })).getByText("Owner")).toBeInTheDocument();
  });

  it("Snap the group checks you in once", async () => {
    const { default: GroupPage } = await import("@/app/(main)/groups/view/page");
    render(<GroupPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Snap the group/ }));
    expect(await screen.findByRole("button", { name: /Checked in today/ })).toBeDisabled();
    expect(notify).toHaveBeenCalledWith({ message: "Everyone's in today" });
  });
});

describe("New goal", () => {
  it("start stays disabled until valid; a count needs a unit; sends the draft", async () => {
    responses["/v1/groups/g1/goals"] = detail;
    const { NewGoalSheet } = await import("./group-sheets");
    const onSaved = vi.fn();
    render(<NewGoalSheet group={detail} open today="2026-10-14" onClose={vi.fn()} onSaved={onSaved} />);
    const sheet = screen.getByRole("dialog");
    const start = within(sheet).getByRole("button", { name: "Start goal" });
    expect(start).toBeDisabled(); // no title yet
    fireEvent.change(within(sheet).getByLabelText(/^Goal/), { target: { value: "70k steps" } });
    expect(start).toBeEnabled();
    fireEvent.change(within(sheet).getByLabelText(/^Unit/), { target: { value: "" } });
    expect(start).toBeDisabled();
    fireEvent.change(within(sheet).getByLabelText(/^Unit/), { target: { value: "steps" } });
    fireEvent.click(start);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls.find((c) => c.path === "/v1/groups/g1/goals")?.body).toMatchObject({ title: "70k steps", mode: "each", tracking: "quantity", unit: "steps", target: 70000, period: "week" });
  });
});
