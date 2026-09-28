import {
  createHabitDefinitionSchema,
  upsertHabitLogSchema,
} from "@life/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { ensureDefaultUser } from "../db/ensure-user.js";
import { habitDefinitions, habitLogs } from "../db/schema.js";
import { requireApiKey } from "../lib/auth.js";

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function mapDefinition(row: typeof habitDefinitions.$inferSelect) {
  return {
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
  };
}

function mapLog(row: typeof habitLogs.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    habitDefinitionId: row.habitDefinitionId,
    logDate: row.logDate,
    payload: row.payload ?? {},
    deviceId: row.deviceId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: toIso(row.deletedAt),
  };
}

export async function habitRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireApiKey);

  app.get("/v1/habits/definitions", async () => {
    const userId = await ensureDefaultUser();
    const rows = await db
      .select()
      .from(habitDefinitions)
      .where(
        and(eq(habitDefinitions.userId, userId), isNull(habitDefinitions.deletedAt)),
      );
    return { items: rows.map(mapDefinition) };
  });

  app.post("/v1/habits/definitions", async (request, reply) => {
    const parsed = createHabitDefinitionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "validation_error", message: parsed.error.message },
      });
    }

    const userId = await ensureDefaultUser();
    const slug = parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const [row] = await db
      .insert(habitDefinitions)
      .values({
        userId,
        slug: `${slug}-${crypto.randomUUID().slice(0, 8)}`,
        name: parsed.data.name,
        category: parsed.data.category,
        trackingMethod: parsed.data.trackingMethod,
        frequency: parsed.data.frequency,
        config: parsed.data.config ?? {},
        isSystem: false,
      })
      .returning();

    return reply.status(201).send(mapDefinition(row));
  });

  app.post("/v1/habits/logs", async (request, reply) => {
    const parsed = upsertHabitLogSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "validation_error", message: parsed.error.message },
      });
    }

    const userId = await ensureDefaultUser();
    const now = new Date();

    const [row] = await db
      .insert(habitLogs)
      .values({
        userId,
        habitDefinitionId: parsed.data.habitDefinitionId,
        logDate: parsed.data.logDate,
        payload: parsed.data.payload,
        deviceId: parsed.data.deviceId ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [habitLogs.habitDefinitionId, habitLogs.logDate],
        set: {
          payload: parsed.data.payload,
          deviceId: parsed.data.deviceId ?? null,
          updatedAt: now,
        },
      })
      .returning();

    return reply.status(201).send(mapLog(row));
  });
}
