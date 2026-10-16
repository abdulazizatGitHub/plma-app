import { profilePatchSchema, shareRequestSchema, usernameSchema } from "@life/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { Sql } from "postgres";
import { z } from "zod";
import type { PushSender } from "../reminders/service.js";
import {
  SocialError,
  acceptFriend,
  acceptInvite,
  activity,
  allowList,
  block,
  createShare,
  friendsOf,
  invitePreview,
  leaderboard,
  markActivitySeen,
  myInvite,
  openSnap,
  profile,
  removeFriend,
  requestFriend,
  sendKudos,
  setAllowList,
  unblock,
  updateProfile,
  usernameAvailable,
} from "./service.js";

export type SocialDeps = { sql: Sql; send: PushSender | null };

const bad = (reply: FastifyReply, message: string) => reply.status(400).send({ error: { code: "validation_error", message } });

async function guard<T>(reply: FastifyReply, run: () => Promise<T>) {
  try {
    return await run();
  } catch (err) {
    if (err instanceof SocialError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    throw err;
  }
}

const idParam = z.object({ id: z.string().uuid() });
const boardQuery = z.object({ board: z.enum(["friends", "everyone"]).default("friends"), period: z.enum(["week", "month"]).default("week") });

/** Authenticated social routes (Phase 9a); registered inside the v1 plugin, after requireAuth. */
export function registerSocialRoutes(app: FastifyInstance, deps: SocialDeps) {
  const { sql } = deps;
  const me = (request: { auth?: { id: string } }) => request.auth!.id;

  app.get("/v1/me", async (request) => profile(sql, me(request)));
  app.patch("/v1/me", async (request, reply) => {
    const body = profilePatchSchema.safeParse(request.body);
    if (!body.success) return bad(reply, body.error.issues[0]?.message ?? "Invalid profile");
    return guard(reply, () => updateProfile(sql, me(request), body.data));
  });
  app.get<{ Params: { name: string } }>("/v1/usernames/:name", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request) => {
    const name = usernameSchema.safeParse(request.params.name);
    return { valid: name.success, available: name.success ? await usernameAvailable(sql, name.data, me(request)) : false };
  });

  app.get("/v1/friends", async (request) => friendsOf(sql, me(request)));
  app.post("/v1/friends/request", async (request, reply) => {
    const body = z.object({ username: usernameSchema }).safeParse(request.body);
    if (!body.success) return bad(reply, "Enter a username.");
    return guard(reply, () => requestFriend(deps, me(request), body.data.username));
  });
  for (const action of ["accept", "decline", "remove", "block", "unblock"] as const) {
    app.post<{ Params: { id: string } }>(`/v1/friends/:id/${action}`, async (request, reply) => {
      const p = idParam.safeParse(request.params);
      if (!p.success) return bad(reply, "Unknown person.");
      const userId = me(request);
      return guard<{ status: string }>(reply, () => {
        if (action === "accept") return acceptFriend(deps, userId, p.data.id);
        if (action === "block") return block(sql, userId, p.data.id);
        if (action === "unblock") return unblock(sql, userId, p.data.id);
        return removeFriend(sql, userId, p.data.id);
      });
    });
  }
  app.get("/v1/visibility/allow", async (request) => ({ friendIds: await allowList(sql, me(request)) }));
  app.put("/v1/visibility/allow", async (request, reply) => {
    const body = z.object({ friendIds: z.array(z.string().uuid()).max(500) }).safeParse(request.body);
    if (!body.success) return bad(reply, "friendIds must be a list.");
    return { friendIds: await setAllowList(sql, me(request), body.data.friendIds) };
  });

  app.get("/v1/invite", async (request) => myInvite(sql, me(request)));
  app.post("/v1/invite/new", async (request) => myInvite(sql, me(request), true));
  app.post<{ Params: { code: string } }>("/v1/invite/:code/accept", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) =>
    guard(reply, () => acceptInvite(deps, me(request), request.params.code.slice(0, 40))),
  );

  app.get("/v1/leaderboard", async (request, reply) => {
    const q = boardQuery.safeParse(request.query);
    if (!q.success) return bad(reply, "Unknown board.");
    return guard(reply, () => leaderboard(sql, me(request), q.data.board, q.data.period));
  });

  app.post("/v1/shares", async (request, reply) => {
    const body = shareRequestSchema.safeParse(request.body);
    if (!body.success) return bad(reply, body.error.issues[0]?.message ?? "Invalid share");
    return guard(reply, () => createShare(deps, me(request), body.data));
  });
  app.post<{ Params: { id: string } }>("/v1/shares/:id/kudos", async (request, reply) => {
    const p = idParam.safeParse(request.params);
    if (!p.success) return bad(reply, "Unknown share.");
    return guard(reply, () => sendKudos(deps, me(request), p.data.id));
  });
  app.post<{ Params: { id: string } }>("/v1/snaps/:id/open", async (request, reply) => {
    const p = idParam.safeParse(request.params);
    if (!p.success) return bad(reply, "Unknown snap.");
    return guard(reply, () => openSnap(sql, me(request), p.data.id));
  });
  app.get("/v1/activity", async (request) => activity(sql, me(request)));
  app.post("/v1/activity/seen", async (request) => markActivitySeen(sql, me(request)));
}

/** Public: the inviter's card on an invite link (name, @username, avatar only). */
export function registerPublicSocialRoutes(app: FastifyInstance, sql: Sql) {
  app.get<{ Params: { code: string } }>("/v1/public/invite/:code", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const person = await invitePreview(sql, request.params.code.slice(0, 40));
    return person ? { inviter: { name: person.name, username: person.username, avatarColor: person.avatarColor } } : reply.status(404).send({ error: { code: "not_found", message: "This invite link isn't valid any more." } });
  });
}
