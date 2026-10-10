import { packById, syncPullQueryV2Schema } from "@life/shared";
import type { FastifyInstance } from "fastify";
import type { Sql } from "postgres";
import { requireAuth, type TokenVerifier } from "../lib/auth.js";
import { planPush } from "../sync/plan.js";
import { applyPush, postgresLookup, pullChanges, userBootstrapper } from "../sync/store.js";
import { existingCategories, packPushBody, packSummaries } from "../templates/packs.js";

/**
 * Authenticated v1 API (SYSTEM_DESIGN §6). Identity comes only from the
 * verified Supabase JWT; every query is scoped to that user.
 */
export function apiRoutes(sql: Sql, verify: TokenVerifier) {
  const ensureUser = userBootstrapper(sql);
  const lookup = postgresLookup(sql);

  return function (app: FastifyInstance, _opts: unknown, done: () => void) {
    app.addHook("preHandler", requireAuth(verify, ensureUser));

    app.get("/v1/me", async (request) => {
      const [user] = await sql<{ id: string; email: string | null; display_name: string | null }[]>`
        SELECT id, email, display_name FROM users WHERE id = ${request.auth!.id}`;
      return { id: user.id, email: user.email, displayName: user.display_name };
    });

    app.get("/v1/sync/pull", async (request, reply) => {
      const query = syncPullQueryV2Schema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({ error: { code: "validation_error", message: query.error.message } });
      }
      return pullChanges(sql, request.auth!.id, query.data.since);
    });

    app.post("/v1/sync/push", async (request, reply) => {
      const userId = request.auth!.id;
      const plan = await planPush(userId, request.body, lookup);
      if (!plan.ok) {
        return reply.status(plan.status).send({ error: { code: plan.code, message: plan.message } });
      }
      try {
        const { accepted, stale } = await applyPush(sql, userId, plan.rows);
        return { serverTime: new Date().toISOString(), accepted, stale };
      } catch (err) {
        // Two devices created the same item/date occurrence with different ids.
        if ((err as { code?: string }).code === "23505") {
          return reply.status(409).send({ error: { code: "duplicate_occurrence", message: "This day already has an entry for that item; pull and retry." } });
        }
        throw err;
      }
    });

    // Starter packs (Phase 3). The app applies them offline; this is the server path.
    app.get("/v1/templates", () => ({ templates: packSummaries() }));

    app.post<{ Params: { id: string } }>("/v1/templates/:id/apply", async (request, reply) => {
      const userId = request.auth!.id;
      if (!packById(request.params.id)) {
        return reply.status(404).send({ error: { code: "not_found", message: "No such starter pack." } });
      }
      const body = packPushBody(request.params.id, userId, await existingCategories(sql, userId));
      if (!body) return { applied: false, reason: "already_adopted" };
      const plan = await planPush(userId, body, lookup);
      if (!plan.ok) return reply.status(plan.status).send({ error: { code: plan.code, message: plan.message } });
      const { accepted } = await applyPush(sql, userId, plan.rows);
      return { applied: true, accepted };
    });

    done();
  };
}
