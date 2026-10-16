import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { healthResponseSchema } from "@life/shared";
import { sql } from "drizzle-orm";
import Fastify from "fastify";
import { db, pg } from "./db/index.js";
import { env } from "./env.js";
import { createTokenVerifier } from "./lib/auth.js";
import { transientDbErrors } from "./lib/errors.js";
import { webPushSender } from "./reminders/push.js";
import { registerActionRoute } from "./reminders/routes.js";
import { closeAllDays } from "./history/close.js";
import { registerPublicSocialRoutes } from "./social/routes.js";
import { registerPublicGroupRoutes } from "./groups/routes.js";
import { finalizeGroupGoals, finalizeGroupPodiums } from "./groups/service.js";
import { finalizePodiums } from "./social/service.js";
import { nudgeStreaks } from "./social/streaks.js";
import { planDebouncer, planUser, replanAll, tick } from "./reminders/service.js";
import { apiRoutes } from "./routes/v1.js";

const app = Fastify({ logger: true });

// Security headers on every response (JSON API: no inline content to allow).
// The web app calls this API from its own origin; CORS decides who may read, so allow cross-origin reads here.
await app.register(helmet, { global: true, crossOriginResourcePolicy: { policy: "cross-origin" } });

// Normal use is a sync every ~30-60 s plus edits; this only stops floods and abuse.
await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

app.setErrorHandler(transientDbErrors);

await app.register(cors, {
  origin: env.corsOrigins,
  // PATCH /v1/me and PUT /v1/visibility/allow (Phase 9a) need more than the default GET/HEAD/POST.
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

app.get("/health", () => {
  const payload = {
    status: "ok" as const,
    service: "life-api",
    timestamp: new Date().toISOString(),
  };
  return healthResponseSchema.parse(payload);
});

app.get("/health/db", async (_request, reply) => {
  try {
    await db.execute(sql`select 1 as ok`);
    return {
      status: "ok" as const,
      database: "connected" as const,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    app.log.warn({ err }, "Database health check failed");
    return reply.status(503).send({
      status: "error",
      database: "unavailable",
      message:
        "Set DATABASE_URL in apps/api/.env — see docs/DATABASE_SETUP.md",
    });
  }
});

if (!env.supabaseUrl) {
  app.log.warn("NEXT_PUBLIC_SUPABASE_URL is not set — authenticated routes will reject every request");
}

const verify = createTokenVerifier({ supabaseUrl: env.supabaseUrl, jwtSecret: env.supabaseJwtSecret });

// Reminders (Phase 6): Web Push when VAPID keys are set; otherwise the rest of the API runs without them.
const pushReady = !!(env.vapidPublicKey && env.vapidPrivateKey && env.reminderActionSecret);
if (!pushReady) app.log.warn("VAPID keys / REMINDER_ACTION_SECRET not set — reminders are off");
const send = pushReady ? webPushSender({ publicKey: env.vapidPublicKey, privateKey: env.vapidPrivateKey, subject: env.vapidSubject }) : null;
const onJobError = (err: unknown) => app.log.error({ err }, "reminder job failed");
const replanSoon = planDebouncer((userId) => planUser(pg, userId), 3000, onJobError);
const reminderDeps = { sql: pg, send, actionSecret: env.reminderActionSecret, vapidPublicKey: env.vapidPublicKey, replanSoon };
registerActionRoute(app, reminderDeps);
registerPublicSocialRoutes(app, pg);
registerPublicGroupRoutes(app, pg);
await app.register(apiRoutes(pg, verify, reminderDeps));

if (send && env.reminderJobs !== "off") {
  // The queue table is the job queue (FOR UPDATE SKIP LOCKED): safe with several instances.
  let ticking = false;
  const runTick = async () => {
    if (ticking) return;
    ticking = true;
    try {
      await tick({ sql: pg, send, actionSecret: env.reminderActionSecret });
    } catch (err) {
      onJobError(err);
    } finally {
      ticking = false;
    }
  };
  setTimeout(() => {
    void runTick();
    setInterval(() => void runTick(), 60_000);
  }, 60_000 - (Date.now() % 60_000) + 1_000);
  const sweep = () => void replanAll(pg).catch(onJobError);
  setTimeout(sweep, 10_000);
  setInterval(sweep, 60 * 60_000);
}

// History (Phase 7): close days that left their correction window, hourly for every account
// (each pull also closes the caller's days, so this only covers devices that stay away).
if (env.reminderJobs !== "off") {
  // …then gives podium awards for leaderboard periods that have fully closed (Phase 9a).
  // …and nudges snap streaks that are about to end (owner, 2026-10-16).
  const closeSweep = () =>
    void closeAllDays(pg)
      .then(() => finalizePodiums(pg))
      .then(() => nudgeStreaks(pg, send))
      .then(() => finalizeGroupGoals(pg))
      .then(() => finalizeGroupPodiums(pg))
      .catch(onJobError);
  setTimeout(closeSweep, 20_000);
  setInterval(closeSweep, 60 * 60_000);
}

try {
  await app.listen({ port: env.port, host: env.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
