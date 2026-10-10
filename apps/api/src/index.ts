import cors from "@fastify/cors";
import { healthResponseSchema } from "@life/shared";
import { sql } from "drizzle-orm";
import Fastify from "fastify";
import { db, pg } from "./db/index.js";
import { env } from "./env.js";
import { createTokenVerifier } from "./lib/auth.js";
import { apiRoutes } from "./routes/v1.js";

const app = Fastify({ logger: true });

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
