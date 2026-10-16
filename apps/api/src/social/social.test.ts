import { awardDef, initials, isValidUsername, shareText, type SharePayload } from "@life/shared";
import { describe, expect, it } from "vitest";
import { canSeeRule, pair, type Visibility } from "./privacy.js";
import { rank } from "./service.js";

describe("who may see whose progress (SOC-05/06)", () => {
  const base = { self: false, blocked: false, friends: false, allowed: false };
  const see = (visibility: Visibility, over: Partial<typeof base> = {}) => canSeeRule({ ...base, ...over, visibility });

  it("everyone / friends / selected / only me", () => {
    expect(see("everyone")).toBe(true);
    expect(see("friends")).toBe(false);
    expect(see("friends", { friends: true })).toBe(true);
    expect(see("selected", { friends: true })).toBe(false); // a friend, but not picked
    expect(see("selected", { friends: true, allowed: true })).toBe(true);
    expect(see("selected", { allowed: true })).toBe(false); // picked once, no longer a friend
    expect(see("private", { friends: true, allowed: true })).toBe(false);
  });

  it("a block hides everything both ways; you always see yourself", () => {
    expect(see("everyone", { blocked: true })).toBe(false);
    expect(see("friends", { friends: true, blocked: true })).toBe(false);
    expect(see("private", { self: true })).toBe(true);
  });

  it("friendships are stored under one ordered pair", () => {
    expect(pair("b", "a")).toEqual(["a", "b"]);
    expect(pair("a", "b")).toEqual(["a", "b"]);
  });
});

describe("leaderboard ranking", () => {
  it("equal points share a rank (1, 1, 3); ties list by name", () => {
    const r = rank([
      { name: "Zed", points: 40 },
      { name: "Ali", points: 50 },
      { name: "Bea", points: 40 },
      { name: "Cat", points: 10 },
    ]);
    expect(r.map((x) => [x.name, x.rank])).toEqual([
      ["Ali", 1],
      ["Bea", 2],
      ["Zed", 2],
      ["Cat", 4],
    ]);
  });
});

describe("social helpers", () => {
  it("usernames: 3–20, lowercase letters, digits and _, starting with a letter", () => {
    expect(isValidUsername("ali_99")).toBe(true);
    expect(isValidUsername("Ali")).toBe(true); // lowercased
    expect(isValidUsername("9ali")).toBe(false);
    expect(isValidUsername("al")).toBe(false);
    expect(isValidUsername("ali-k")).toBe(false);
  });

  it("initials and share lines", () => {
    expect(initials("Abdul Aziz Khan")).toBe("AK");
    expect(initials("", "sara")).toBe("S");
    const fajr: SharePayload = { kind: "item_streak", title: "Fajr", current: 21, best: 30, prayer: true };
    expect(shareText("Ali", fajr)).toBe("Ali shared a 21-day Fajr streak");
    const day: SharePayload = { kind: "day", date: "2026-10-12", complete: true, perfect: true, rings: { prayer: [5, 5], commit: [3, 3], balance: [2, 2] } };
    expect(shareText("Sara", day)).toBe("Sara closed every ring on Monday — a perfect day");
    const partial: SharePayload = { ...day, complete: false, perfect: false, rings: { prayer: [5, 5], commit: [1, 3], balance: null } };
    expect(shareText("Sara", partial)).toBe("Sara closed the Prayer ring on Monday");
  });

  it("podium awards name the board, place and period", () => {
    expect(awardDef("podium:global:week:2026-10-05:1")).toMatchObject({ group: "leaderboards", title: "Gold · everyone", description: "1st place on the Everyone board, week of 5 Oct." });
    expect(awardDef("podium:friends:month:2026-09:3")?.description).toBe("3rd place on the Friends board, September 2026.");
    expect(awardDef("podium:global:week:2026-10-05:4")).toBeNull();
  });
});
