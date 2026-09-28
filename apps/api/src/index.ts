import cors from "@fastify/cors";
import { healthResponseSchema } from "@life/shared";
import { sql } from "drizzle-orm";
import Fastify from "fastify";
import { db } from "./db/index.js";
import { habitRoutes } from "./routes/habits.js";
import { syncRoutes } from "./routes/sync.js";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"],
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

await app.register(habitRoutes);
await app.register(syncRoutes);

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
