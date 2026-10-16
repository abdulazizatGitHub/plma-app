import {
  ENTITY_SPECS,
  SYNC_ENTITIES,
  parseSyncRow,
  syncPushBodyV2Schema,
  type SyncEntity,
} from "@life/shared";

export type Row = Record<string, unknown> & { id: string; userId: string };

/** Database lookups the planner needs; implemented against Postgres in store.ts. */
export type OwnershipLookup = {
  /** Of `ids`, those that already exist in `entity` but belong to another user. */
  foreignIds(entity: SyncEntity, ids: string[], userId: string): Promise<string[]>;
  /** Of `ids`, those that exist in `entity` and belong to `userId`. */
  ownedIds(entity: SyncEntity, ids: string[], userId: string): Promise<string[]>;
  /** Stored group-goal items of `userId` among `ids` (Phase 9b): what a member may not change. */
  linkedItems?(ids: string[], userId: string): Promise<Map<string, { groupGoalId: string; title: string; tracking: unknown; schedule: unknown }>>;
};

/** A member may change a linked item's category, priority, order or archive it — not what the goal defines. */
const LOCKED_FIELDS = ["groupGoalId", "title", "tracking", "schedule"] as const;

/** JSON with sorted keys: jsonb reorders keys, so plain stringify can't compare. */
function canonical(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(",")}}`;
}

export type PushPlan =
  | { ok: true; rows: Map<SyncEntity, Row[]> }
  | { ok: false; status: 400 | 403 | 409 | 422; code: string; message: string };

const fail = (status: 400 | 403 | 409 | 422, code: string, message: string): PushPlan => ({ ok: false, status, code, message });

/**
 * Validates a push and checks ownership before anything is written:
 *  - every row matches its entity schema and belongs to the caller;
 *  - no row id is already owned by another user (no cross-user overwrite);
 *  - every reference (categoryId, parentId, itemId…) points at a row the caller
 *    owns, either already stored or in this same batch (closes BUG-002).
 */
export async function planPush(userId: string, body: unknown, lookup: OwnershipLookup): Promise<PushPlan> {
  const parsed = syncPushBodyV2Schema.safeParse(body);
  if (!parsed.success) return fail(400, "validation_error", parsed.error.message);

  const rows = new Map<SyncEntity, Row[]>();
  for (const [i, change] of parsed.data.changes.entries()) {
    const result = parseSyncRow(change.entity, change.row);
    if (!result.success) {
      return fail(400, "validation_error", `changes[${i}] (${change.entity}): ${result.error.message}`);
    }
    const row = result.data as Row;
    if (row.userId !== userId) return fail(403, "forbidden", `changes[${i}] belongs to another user`);
    if (change.entity === "userSettings" && row.id !== userId) {
      return fail(403, "forbidden", "user settings id must equal the user id");
    }

    const list = rows.get(change.entity) ?? [];
    // Last one wins if the same row appears twice in a batch.
    const at = list.findIndex((r) => r.id === row.id);
    if (at >= 0) list[at] = row;
    else list.push(row);
    rows.set(change.entity, list);
  }

  // Group-goal items (Phase 9b) are created by the server; members can't make or redefine them.
  const linked = (rows.get("items") ?? []).filter((r) => r.groupGoalId !== null);
  if (linked.length) {
    const stored = lookup.linkedItems ? await lookup.linkedItems(linked.map((r) => r.id), userId) : new Map<string, Record<string, unknown>>();
    for (const r of linked) {
      const s = stored.get(r.id);
      const same = !!s && LOCKED_FIELDS.every((f) => canonical((s as Record<string, unknown>)[f]) === canonical(r[f]));
      if (!same) return fail(422, "group_goal_item", "A group goal's item is set by the group — only its category, priority and reminders can change.");
    }
  }

  for (const [entity, list] of rows) {
    const foreign = await lookup.foreignIds(entity, list.map((r) => r.id), userId);
    if (foreign.length) return fail(409, "id_conflict", `${entity} id already used by another account`);
  }

  for (const [entity, list] of rows) {
    for (const [column, target] of Object.entries(ENTITY_SPECS[entity].refs)) {
      const wanted = [...new Set(list.map((r) => r[column]).filter((v): v is string => typeof v === "string"))];
      if (!wanted.length) continue;
      const inBatch = new Set((rows.get(target) ?? []).map((r) => r.id));
      const missing = wanted.filter((id) => !inBatch.has(id));
      if (!missing.length) continue;
      const owned = new Set(await lookup.ownedIds(target, missing, userId));
      const unknown = missing.filter((id) => !owned.has(id));
      if (unknown.length) {
        return fail(422, "unknown_reference", `${entity}.${column} points at a ${target} row you do not own`);
      }
    }
  }

  // Keep dependency order for the writes.
  return { ok: true, rows: new Map(SYNC_ENTITIES.filter((e) => rows.has(e)).map((e) => [e, rows.get(e)!])) };
}
