import { eq } from "drizzle-orm";
import { db } from "./index.js";
import { habitDefinitions, users } from "./schema.js";
import { systemHabitTemplates } from "./seed-templates.js";

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID;

export async function ensureDefaultUser(): Promise<string> {
  if (DEFAULT_USER_ID) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, DEFAULT_USER_ID))
      .limit(1);
    if (existing) {
      await seedSystemHabits(existing.id);
      return existing.id;
    }
  }

  const [created] = await db
    .insert(users)
    .values(
      DEFAULT_USER_ID
        ? { id: DEFAULT_USER_ID, displayName: "Owner" }
        : { displayName: "Owner" },
    )
    .returning({ id: users.id });

  await seedSystemHabits(created.id);
  return created.id;
}

export async function seedSystemHabits(userId: string) {
  for (const template of systemHabitTemplates) {
    await db
      .insert(habitDefinitions)
      .values({
        userId,
        slug: template.slug,
        name: template.name,
        category: template.category,
        trackingMethod: template.trackingMethod,
        frequency: template.frequency,
        config: template.config,
        isSystem: template.isSystem,
      })
      .onConflictDoNothing({
        target: [habitDefinitions.userId, habitDefinitions.slug],
      });
  }
}
