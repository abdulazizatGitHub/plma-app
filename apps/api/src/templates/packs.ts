import { randomUUID } from "node:crypto";
import { applyPacks, STARTER_PACKS, type Category, type SyncPushBodyV2 } from "@life/shared";
import type { Sql } from "postgres";

/*
 * Starter packs on the server (Phase 3, CAT-05). The definitions live in
 * @life/shared so the app can onboard offline; the API serves the same list,
 * applies a pack for clients that prefer the server, and seeds the
 * `templates` table for the Phase 12 library.
 */

export type PackSummary = {
  id: string;
  version: number;
  name: string;
  description: string;
  category: { name: string; icon: string; color: string };
  items: { title: string; type: string; subItems: number }[];
};

export function packSummaries(): PackSummary[] {
  return STARTER_PACKS.map((p) => ({
    id: p.id,
    version: p.version,
    name: p.name,
    description: p.description,
    category: p.category,
    items: p.items.map((i) => ({ title: i.title, type: i.type, subItems: i.children?.length ?? 0 })),
  }));
}

type ExistingCategory = { id: string; sourceTemplateId: string | null; deletedAt: string | null; sortOrder: number };

/**
 * The push body that adopts `packId` for a user, or null when they already
 * have it. It goes through the normal push planner, so ownership and schema
 * checks are the same as for any client write.
 */
export function packPushBody(packId: string, userId: string, existing: ExistingCategory[], now = new Date().toISOString()): SyncPushBodyV2 | null {
  const firstSortOrder = existing.filter((c) => !c.deletedAt).reduce((max, c) => Math.max(max, c.sortOrder + 1), 0);
  const changes = applyPacks([packId], existing as unknown as Category[], { userId, now, deviceId: null }, randomUUID, firstSortOrder);
  return changes.length ? { changes: changes.map((c) => ({ entity: c.entity, row: c.row })) } : null;
}

export async function existingCategories(sql: Sql, userId: string): Promise<ExistingCategory[]> {
  const rows = await sql<{ id: string; source_template_id: string | null; deleted_at: Date | null; sort_order: number }[]>`
    SELECT id, source_template_id, deleted_at, sort_order FROM categories WHERE user_id = ${userId}`;
  return rows.map((r) => ({ id: r.id, sourceTemplateId: r.source_template_id, deletedAt: r.deleted_at?.toISOString() ?? null, sortOrder: r.sort_order }));
}

/** Upserts the system packs (owner_user_id null) into `templates`; safe to re-run. */
export async function seedTemplates(sql: Sql): Promise<number> {
  for (const p of STARTER_PACKS) {
    const payload = { category: p.category, items: p.items };
    await sql`
      INSERT INTO templates (id, owner_user_id, name, description, items, version, visibility)
      VALUES (${p.id}, NULL, ${p.name}, ${p.description}, ${JSON.stringify(payload)}::jsonb, ${p.version}, 'public')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        items = EXCLUDED.items,
        version = EXCLUDED.version,
        visibility = EXCLUDED.visibility,
        updated_at = now()`;
  }
  return STARTER_PACKS.length;
}
