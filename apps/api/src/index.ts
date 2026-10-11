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
await app.register(apiRoutes(pg, verify));

try {
  await app.listen({ port: env.port, host: env.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
