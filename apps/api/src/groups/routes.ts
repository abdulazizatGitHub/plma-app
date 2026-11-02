import { goalDraftSchema, groupDraftSchema } from "@life/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { Sql } from "postgres";
import { z } from "zod";
import type { PushSender } from "../reminders/service.js";
import { SocialError } from "../social/service.js";
import {
  acceptGroupLink,
  answerInvite,
  archiveGoal,
  createGoal,
  createGroup,
  deleteGroup,
  groupBoard,
  groupDetail,
  groupLink,
  groupLinkPreview,
  inviteFriends,
  leaveGroup,
  myGroups,
  setRole,
  snapGroup,
  updateGroup,
} from "./service.js";

type Deps = { sql: Sql; send: PushSender | null };

const bad = (reply: FastifyReply, message: string) => reply.status(400).send({ error: { code: "validation_error", message } });
async function guard<T>(reply: FastifyReply, run: () => Promise<T>) {
  try {
    return await run();
  } catch (err) {
    if (err instanceof SocialError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    throw err;
  }
}
const uuid = z.string().uuid();
type P = { Params: { id: string; goalId?: string; userId?: string; code?: string } };

/** Group routes (Phase 9b); inside the v1 plugin, after requireAuth. Every one checks membership and role. */
export function registerGroupRoutes(app: FastifyInstance, deps: Deps) {
  const { sql } = deps;
  const me = (r: { auth?: { id: string } }) => r.auth!.id;
  const id = (reply: FastifyReply, v: string | undefined) => (uuid.safeParse(v).success ? v! : null);
  const limited = { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } };

  app.get("/v1/groups", async (request) => myGroups(sql, me(request)));
  app.post("/v1/groups", limited, async (request, reply) => {
    const d = groupDraftSchema.safeParse(request.body);
    if (!d.success) return bad(reply, d.error.issues[0]?.message ?? "Invalid group");
    return guard(reply, () => createGroup(sql, me(request), d.data));
  });
  app.get<P>("/v1/groups/board", async (request, reply) => {
    const q = z.object({ period: z.enum(["week", "month"]).default("week"), scope: z.enum(["mine", "public"]).default("mine") }).safeParse(request.query);
    if (!q.success) return bad(reply, "Unknown board.");
    return groupBoard(sql, me(request), q.data.period, q.data.scope);
  });
  app.get<P>("/v1/groups/:id", async (request, reply) => {
    const g = id(reply, request.params.id);
    return g ? guard(reply, () => groupDetail(sql, me(request), g)) : bad(reply, "Unknown group.");
  });
  app.patch<P>("/v1/groups/:id", async (request, reply) => {
    const g = id(reply, request.params.id);
    const d = groupDraftSchema.partial().safeParse(request.body);
    if (!g || !d.success) return bad(reply, "Invalid change.");
    return guard(reply, () => updateGroup(sql, me(request), g, d.data));
  });
  app.post<P>("/v1/groups/:id/leave", async (request, reply) => {
    const g = id(reply, request.params.id);
    return g ? guard(reply, () => leaveGroup(sql, me(request), g)) : bad(reply, "Unknown group.");
  });
  app.post<P>("/v1/groups/:id/delete", async (request, reply) => {
    const g = id(reply, request.params.id);
    return g ? guard(reply, () => deleteGroup(sql, me(request), g)) : bad(reply, "Unknown group.");
  });
  app.post<P>("/v1/groups/:id/invite", limited, async (request, reply) => {
    const g = id(reply, request.params.id);
    const b = z.object({ friendIds: z.array(uuid).min(1).max(50) }).safeParse(request.body);
    if (!g || !b.success) return bad(reply, "Pick friends to invite.");
    return guard(reply, () => inviteFriends(deps, me(request), g, b.data.friendIds));
  });
  for (const answer of ["accept", "decline"] as const) {
    app.post<P>(`/v1/groups/invites/:id/${answer}`, async (request, reply) => {
      const i = id(reply, request.params.id);
      return i ? guard(reply, () => answerInvite(deps, me(request), i, answer === "accept")) : bad(reply, "Unknown invite.");
    });
  }
  app.get<P>("/v1/groups/:id/link", async (request, reply) => {
    const g = id(reply, request.params.id);
    return g ? guard(reply, () => groupLink(sql, me(request), g)) : bad(reply, "Unknown group.");
  });
  app.post<P>("/v1/groups/:id/link", async (request, reply) => {
    const g = id(reply, request.params.id);
    return g ? guard(reply, () => groupLink(sql, me(request), g, true)) : bad(reply, "Unknown group.");
  });
  app.post<P>("/v1/group-invite/:code/accept", limited, async (request, reply) =>
    guard(reply, () => acceptGroupLink(deps, me(request), (request.params.code ?? "").slice(0, 40))),
  );
  app.post<P>("/v1/groups/:id/members/:userId/:action", async (request, reply) => {
    const g = id(reply, request.params.id);
    const u = id(reply, request.params.userId);
    const action = (request.params as { action?: string }).action;
    if (!g || !u || (action !== "admin" && action !== "member" && action !== "remove")) return bad(reply, "Unknown change.");
    return guard(reply, () => setRole(sql, me(request), g, u, action));
  });
  app.post<P>("/v1/groups/:id/goals", limited, async (request, reply) => {
    const g = id(reply, request.params.id);
    const d = goalDraftSchema.safeParse(request.body);
    if (!g) return bad(reply, "Unknown group.");
    if (!d.success) return bad(reply, d.error.issues[0]?.message ?? "Invalid goal");
    return guard(reply, () => createGoal(deps, me(request), g, d.data));
  });
  app.post<P>("/v1/groups/:id/goals/:goalId/archive", async (request, reply) => {
    const g = id(reply, request.params.id);
    const goal = id(reply, request.params.goalId);
    return g && goal ? guard(reply, () => archiveGoal(sql, me(request), g, goal)) : bad(reply, "Unknown goal.");
  });
  app.post<P>("/v1/groups/:id/snaps", limited, async (request, reply) => {
    const g = id(reply, request.params.id);
    return g ? guard(reply, () => snapGroup(deps, me(request), g)) : bad(reply, "Unknown group.");
  });
}

/** Public: a group link's card (name, icon, size). */
export function registerPublicGroupRoutes(app: FastifyInstance, sql: Sql) {
  app.get<{ Params: { code: string } }>("/v1/public/group-invite/:code", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const g = await groupLinkPreview(sql, request.params.code.slice(0, 40));
    return g ? { group: g } : reply.status(404).send({ error: { code: "not_found", message: "This group link isn't valid any more." } });
  });
}
