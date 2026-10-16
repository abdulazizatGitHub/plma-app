import { z } from "zod";
import { RING_LABEL } from "./rings.js";

/*
 * Social (Phase 9a, SOC-01…06, SHR-01, owner 2026-10-16). Private by default:
 * others see only a person's name, points, streak and awards — and only when
 * that person's visibility lets them. Item titles never leave their owner
 * except inside a share the owner sent.
 */

export const AVATAR_COLORS = ["mint", "sky", "lilac", "peach", "pink", "yellow", "lime", "teal"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** 3–20 characters: lowercase letters, digits and underscores, starting with a letter. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_]{2,19}$/, "3–20 characters: letters, numbers and _, starting with a letter");
export const isValidUsername = (s: string) => usernameSchema.safeParse(s).success;

/** Words that can't be usernames (they look official or collide with routes). */
export const RESERVED_USERNAMES = new Set(["admin", "support", "life", "help", "system", "official", "moderator", "everyone", "friends", "invite", "me"]);

export const displayNameSchema = z.string().trim().min(1, "Enter a name").max(40, "40 characters at most");

export const profilePatchSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    username: usernameSchema.optional(),
    avatarColor: z.enum(AVATAR_COLORS).optional(),
  })
  .strict();
export type ProfilePatch = z.infer<typeof profilePatchSchema>;

/** Up to two initials: "Abdul Aziz" → "AA", "sara" → "S". */
export function initials(name: string | null | undefined, username?: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length) return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
  return (username?.[0] ?? "?").toUpperCase();
}

/** A person as others may see them. */
export type PublicPerson = { id: string; name: string; username: string | null; avatarColor: AvatarColor | null };

/** Also shown when their visibility allows it. */
export type PersonProgress = { weekPoints: number; monthPoints: number; level: number; streak: number };

export type FriendsPayload = {
  friends: (PublicPerson & { progress: PersonProgress | null; since: string })[];
  incoming: (PublicPerson & { at: string })[];
  outgoing: (PublicPerson & { at: string })[];
  blocked: PublicPerson[];
};

export type LeaderboardRow = PublicPerson & { rank: number; points: number; you: boolean };
export type LeaderboardPayload = { board: "friends" | "everyone"; period: "week" | "month"; from: string; to: string; rows: LeaderboardRow[]; you: LeaderboardRow | null; hidden: boolean };

/* ---------- shares ---------- */

export const SHARE_KINDS = ["day", "streak", "award", "item_streak"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export const shareRequestSchema = z
  .object({
    kind: z.enum(SHARE_KINDS),
    recipients: z.array(z.string().uuid()).min(1).max(50),
    awardId: z.string().max(60).optional(),
    itemId: z.string().uuid().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();
export type ShareRequest = z.infer<typeof shareRequestSchema>;

/** Built by the server from stored facts; never taken from the client. */
export type SharePayload =
  | {
      kind: "day";
      date: string;
      complete: boolean;
      perfect: boolean;
      rings: { prayer: [number, number] | null; commit: [number, number] | null; balance: [number, number] | null };
    }
  | { kind: "streak"; current: number; best: number }
  | { kind: "award"; awardId: string; title: string; icon: string; earnedAt: string }
  | { kind: "item_streak"; title: string; current: number; best: number; prayer: boolean };

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });

/** One line for push notifications and cards: "Ali shared a 21-day Fajr streak". */
export function shareText(sender: string, p: SharePayload): string {
  switch (p.kind) {
    case "day": {
      const day = WEEKDAY.format(new Date(`${p.date}T12:00:00Z`));
      if (p.complete) return `${sender} closed every ring on ${day}${p.perfect ? " — a perfect day" : ""}`;
      const closed = (["prayer", "commit", "balance"] as const).filter((k) => p.rings[k] && p.rings[k][0] >= p.rings[k][1]);
      return closed.length ? `${sender} closed the ${closed.map((k) => RING_LABEL[k]).join(" and ")} ring${closed.length > 1 ? "s" : ""} on ${day}` : `${sender} shared ${day}`;
    }
    case "streak":
      return `${sender} is on a ${p.current}-day streak`;
    case "award":
      return `${sender} earned "${p.title}"`;
    case "item_streak":
      return `${sender} shared a ${p.current}-day ${p.title} streak`;
  }
}

/** What a share was about, for "kudos on …": "your 21-day Fajr streak", "your Monday". */
export function shareSubject(p: SharePayload): string {
  switch (p.kind) {
    case "day":
      return `your ${WEEKDAY.format(new Date(`${p.date}T12:00:00Z`))}`;
    case "streak":
      return `your ${p.current}-day streak`;
    case "award":
      return `your "${p.title}" award`;
    case "item_streak":
      return `your ${p.current}-day ${p.title} streak`;
  }
}

export type ActivityEntry =
  | { type: "share"; id: string; at: string; from: PublicPerson; payload: SharePayload; kudosSent: boolean; seen: boolean }
  | { type: "kudos"; id: string; at: string; from: PublicPerson; share: SharePayload; seen: boolean }
  | { type: "request"; id: string; at: string; from: PublicPerson; seen: boolean }
  | { type: "accepted"; id: string; at: string; from: PublicPerson; seen: boolean };

export type ActivityPayload = { entries: ActivityEntry[]; unread: number };
