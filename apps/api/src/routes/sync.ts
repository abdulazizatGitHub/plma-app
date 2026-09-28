import { syncPullQuerySchema, syncPushBodySchema } from "@life/shared";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { ensureDefaultUser } from "../db/ensure-user.js";
import { habitDefinitions, habitLogs } from "../db/schema.js";
import { requireApiKey } from "../lib/auth.js";

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

export function syncRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireApiKey);

  app.get("/v1/sync/pull", async (request, reply) => {
    const parsed = syncPullQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "validation_error", message: parsed.error.message },
      });
    }

    const userId = await ensureDefaultUser();
    const since = parsed.data.since ? new Date(parsed.data.since) : null;

    const defWhere = since
      ? and(
          eq(habitDefinitions.userId, userId),
          or(
            gt(habitDefinitions.updatedAt, since),
            gt(habitDefinitions.createdAt, since),
          ),
        )
      : and(eq(habitDefinitions.userId, userId), isNull(habitDefinitions.deletedAt));

    const logWhere = since
      ? and(
          eq(habitLogs.userId, userId),
          or(gt(habitLogs.updatedAt, since), gt(habitLogs.createdAt, since)),
        )
      : eq(habitLogs.userId, userId);

    const [defs, logs] = await Promise.all([
      db.select().from(habitDefinitions).where(defWhere),
      db.select().from(habitLogs).where(logWhere),
    ]);

    return {
      serverTime: new Date().toISOString(),
      habitDefinitions: defs.map((row) => ({
        id: row.id,
        userId: row.userId,
        slug: row.slug,
        name: row.name,
        category: row.category,
        trackingMethod: row.trackingMethod,
        frequency: row.frequency,
        config: row.config ?? {},
        isSystem: row.isSystem,
        archivedAt: toIso(row.archivedAt),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        deletedAt: toIso(row.deletedAt),
      })),
      habitLogs: logs.map((row) => ({
        id: row.id,
        userId: row.userId,
        habitDefinitionId: row.habitDefinitionId,
        logDate: row.logDate,
        payload: row.payload ?? {},
        deviceId: row.deviceId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        deletedAt: toIso(row.deletedAt),
      })),
    };
  });

  app.post("/v1/sync/push", async (request, reply) => {
    const parsed = syncPushBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "validation_error", message: parsed.error.message },
      });
    }

    const userId = await ensureDefaultUser();
    const now = new Date();

    if (parsed.data.habitDefinitions?.length) {
      for (const item of parsed.data.habitDefinitions) {
        if (!item.slug || !item.name) continue;
        await db
          .insert(habitDefinitions)
          .values({
            id: item.id,
            userId,
            slug: item.slug,
            name: item.name,
            category: item.category ?? "custom",
            trackingMethod: item.trackingMethod ?? "boolean",
            frequency: item.frequency ?? "daily",
            config: item.config ?? {},
            isSystem: item.isSystem ?? false,
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : now,
          })
          .onConflictDoUpdate({
            target: habitDefinitions.id,
            set: {
              name: item.name,
              category: item.category ?? "custom",
              trackingMethod: item.trackingMethod ?? "boolean",
              frequency: item.frequency ?? "daily",
              config: item.config ?? {},
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : now,
              deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
            },
          });
      }
    }

    if (parsed.data.habitLogs?.length) {
      for (const item of parsed.data.habitLogs) {
        if (!item.habitDefinitionId || !item.logDate || !item.payload) continue;
        await db
          .insert(habitLogs)
          .values({
            id: item.id,
            userId,
            habitDefinitionId: item.habitDefinitionId,
            logDate: item.logDate,
            payload: item.payload,
            deviceId: item.deviceId ?? null,
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : now,
          })
          .onConflictDoUpdate({
            target: [habitLogs.habitDefinitionId, habitLogs.logDate],
            set: {
              payload: item.payload,
              deviceId: item.deviceId ?? null,
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : now,
              deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
            },
          });
      }
    }

    return reply.status(204).send();
  });
}
