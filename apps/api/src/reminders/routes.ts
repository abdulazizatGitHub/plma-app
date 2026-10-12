import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Sql } from "postgres";
import { z } from "zod";
import { markDone, planUser, snooze, type PushSender } from "./service.js";
import { verifyAction } from "./tokens.js";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(128) }),
});

export type ReminderRouteDeps = {
  sql: Sql;
  /** Null when VAPID keys aren't configured: push routes answer 503. */
  send: PushSender | null;
  actionSecret: string;
  vapidPublicKey: string;
  replanSoon: (userId: string) => void;
};

const unavailable = (reply: FastifyReply) =>
  reply.status(503).send({ error: { code: "push_unavailable", message: "Notifications aren't set up on this server yet." } });

/** Authenticated push routes; registered inside the v1 plugin (after requireAuth). */
export function registerPushRoutes(app: FastifyInstance, deps: ReminderRouteDeps) {
  const { sql } = deps;

  app.get("/v1/push/key", (_req, reply) => (deps.send ? { publicKey: deps.vapidPublicKey } : unavailable(reply)));

  app.post("/v1/push/subscriptions", async (request: FastifyRequest, reply) => {
    if (!deps.send) return unavailable(reply);
    const parsed = subscriptionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: { code: "validation_error", message: parsed.error.message } });
    const userId = request.auth!.id;
    const { endpoint, keys } = parsed.data;
    const agent = String(request.headers["user-agent"] ?? "").slice(0, 200);
    // An endpoint belongs to one browser; if another account used it before, it moves to this one.
    await sql`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
      VALUES (${userId}, ${endpoint}, ${keys.p256dh}, ${keys.auth}, ${agent})
      ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent, failures = 0`;
    deps.replanSoon(userId);
    return { ok: true };
  });

  app.delete("/v1/push/subscriptions", async (request, reply) => {
    const parsed = z.object({ endpoint: z.string().max(2048) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: { code: "validation_error", message: parsed.error.message } });
    await sql`DELETE FROM push_subscriptions WHERE user_id = ${request.auth!.id} AND endpoint = ${parsed.data.endpoint}`;
    return { ok: true };
  });

  app.post("/v1/push/test", async (request, reply) => {
    if (!deps.send) return unavailable(reply);
    const subs = await sql<{ id: string; endpoint: string; p256dh: string; auth: string }[]>`
      SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${request.auth!.id}`;
    if (!subs.length) return reply.status(404).send({ error: { code: "no_device", message: "Turn on notifications on this device first." } });
    const payload = JSON.stringify({ title: "Reminders are on", body: "This is how your reminders will look.", tag: "test", url: "/settings/notifications", token: null });
    let ok = 0;
    for (const s of subs) {
      const r = await deps.send(s, payload);
      if (r === "ok") ok += 1;
      if (r === "gone") await sql`DELETE FROM push_subscriptions WHERE id = ${s.id}`;
    }
    return { sent: ok, devices: subs.length };
  });

  /** What's queued next (shown under the switch so the user can see it works). */
  app.get("/v1/reminders/upcoming", async (request) => {
    const userId = request.auth!.id;
    await planUser(sql, userId);
    const rows = await sql<{ title: string; fire_at: string; kind: string }[]>`
      SELECT title, fire_at, kind FROM reminder_queue WHERE user_id = ${userId} AND status = 'pending' ORDER BY fire_at LIMIT 5`;
    return { upcoming: rows.map((r) => ({ title: r.title, at: new Date(r.fire_at).toISOString(), kind: r.kind })) };
  });
}

/** Unauthenticated: the notification's Done / Snooze buttons, proven by the signed token alone. */
export function registerActionRoute(app: FastifyInstance, deps: Pick<ReminderRouteDeps, "sql" | "actionSecret" | "replanSoon">) {
  app.post("/v1/reminders/action", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = z.object({ token: z.string(), action: z.enum(["done", "snooze"]) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: { code: "validation_error", message: body.error.message } });
    const claims = deps.actionSecret ? verifyAction(deps.actionSecret, body.data.token) : null;
    if (!claims) return reply.status(401).send({ error: { code: "invalid_token", message: "This reminder has expired." } });
    if (body.data.action === "snooze") {
      const at = await snooze(deps.sql, claims);
      return { ok: true, snoozedUntil: at.toISOString() };
    }
    const result = await markDone(deps.sql, claims);
    deps.replanSoon(claims.u);
    return { ok: result === "done" || result === "already", result };
  });
}
