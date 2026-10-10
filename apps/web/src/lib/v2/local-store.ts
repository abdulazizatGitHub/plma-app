import {
  ENTITY_SPECS,
  SYNC_ENTITIES,
  camelToSnake,
  entityColumns,
  snakeToCamel,
  type SyncEntity,
} from "@life/shared";
import type { Database, SqlJsStatic, SqlValue } from "sql.js";
import { idbDelete, idbGet, idbPut } from "./idb";

/*
 * Per-user offline store for v2 (SYSTEM_DESIGN §2, §5.6). One SQLite file per
 * account, persisted to IndexedDB under `user:<id>`, wiped on sign-out (ACC-03).
 * Every local edit is written to its table and appended to the outbox; rows
 * arriving from the server are applied with last-write-wins and never re-queued.
 */

export type StoredRow = Record<string, unknown> & { id: string; updatedAt: string };
export type OutboxEntry = { seq: number; entity: SyncEntity; row: StoredRow };

const fileKey = (userId: string) => `user:${userId}`;
const quote = (s: string) => `"${s}"`;

function schemaSql() {
  const tables = SYNC_ENTITIES.map((entity) => {
    const cols = entityColumns(entity).map((c) => (c === "id" ? `"id" TEXT PRIMARY KEY` : quote(camelToSnake(c))));
    return `CREATE TABLE IF NOT EXISTS ${quote(ENTITY_SPECS[entity].table)} (${cols.join(", ")});`;
  });
  return [
    ...tables,
    `CREATE TABLE IF NOT EXISTS outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, row_id TEXT NOT NULL, row TEXT NOT NULL, queued_at TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS outbox_rejected (seq INTEGER PRIMARY KEY, entity TEXT NOT NULL, row TEXT NOT NULL, error TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  ].join("\n");
}

function toCells(entity: SyncEntity, row: Record<string, unknown>): SqlValue[] {
  const { json, bool } = ENTITY_SPECS[entity];
  return entityColumns(entity).map((c) => {
    const v = row[c] ?? null;
    if (v === null) return null;
    if (json.includes(c)) return JSON.stringify(v);
    if (bool.includes(c)) return v ? 1 : 0;
    return v as SqlValue;
  });
}

function fromCells(entity: SyncEntity, raw: Record<string, SqlValue>): StoredRow {
  const { json, bool } = ENTITY_SPECS[entity];
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(raw)) {
    const c = snakeToCamel(key);
    out[c] = v === null ? null : json.includes(c) ? JSON.parse(String(v)) : bool.includes(c) ? v === 1 : v;
  }
  return out as StoredRow;
}

let sqlJsPromise: Promise<SqlJsStatic> | null = null;
async function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = import("sql.js").then(({ default: init }) => init({ locateFile: (f) => `/${f}` }));
  }
  return sqlJsPromise;
}

/** Stores open in this tab, so a sign-out wipe can stop them writing the file back. */
const openStores = new Set<LocalStore>();

export class LocalStore {
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private discarded = false;
  private listeners = new Set<() => void>();
  /** Bumped on every change; UI reads it through `useSyncExternalStore`. */
  version = 0;

  /** Notifies `listener` after any write (local edit, server row, outbox change). */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private constructor(
    readonly userId: string,
    private readonly db: Database,
  ) {}

  /** Opens (or creates) the signed-in user's store. `sqlJs` is injectable for tests. */
  static async open(userId: string, opts: { sqlJs?: SqlJsStatic } = {}): Promise<LocalStore> {
    const SQL = opts.sqlJs ?? (await loadSqlJs());
    const saved = await idbGet(fileKey(userId));
    const db = saved ? new SQL.Database(saved) : new SQL.Database();
    db.run(schemaSql());
    const store = new LocalStore(userId, db);
    openStores.add(store);
    return store;
  }

  get(entity: SyncEntity, id: string): StoredRow | null {
    return this.query(entity, `WHERE "id" = ?`, [id])[0] ?? null;
  }

  /** Rows of an entity, optionally filtered with a SQL tail (snake_case columns). */
  query(entity: SyncEntity, tail = "", params: SqlValue[] = []): StoredRow[] {
    const stmt = this.db.prepare(`SELECT * FROM ${quote(ENTITY_SPECS[entity].table)} ${tail}`);
    stmt.bind(params);
    const rows: StoredRow[] = [];
    while (stmt.step()) rows.push(fromCells(entity, stmt.getAsObject() as Record<string, SqlValue>));
    stmt.free();
    return rows;
  }

  /** A local edit: write the row and queue it for the server. */
  save(entity: SyncEntity, row: StoredRow) {
    this.write(entity, row);
    this.db.run(`INSERT INTO outbox (entity, row_id, row, queued_at) VALUES (?, ?, ?, ?)`, [
      entity,
      row.id,
      JSON.stringify(row),
      new Date().toISOString(),
    ]);
    this.schedulePersist();
  }

  /**
   * A row from the server. Skipped when the local copy is newer or still has an
   * unsent edit (that edit will reach the server, which decides by updatedAt).
   */
  applyRemote(entity: SyncEntity, row: StoredRow): boolean {
    const local = this.get(entity, row.id);
    if (local && Date.parse(local.updatedAt) > Date.parse(row.updatedAt)) return false;
    if (this.hasPending(entity, row.id)) return false;
    this.write(entity, row);
    this.schedulePersist();
    return true;
  }

  outbox(limit = 200): OutboxEntry[] {
    const stmt = this.db.prepare(`SELECT seq, entity, row FROM outbox ORDER BY seq LIMIT ?`);
    stmt.bind([limit]);
    const out: OutboxEntry[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject() as { seq: number; entity: SyncEntity; row: string };
      out.push({ seq: r.seq, entity: r.entity, row: JSON.parse(r.row) as StoredRow });
    }
    stmt.free();
    return out;
  }

  /** Removes sent entries. */
  ack(seqs: number[]) {
    if (!seqs.length) return;
    this.db.run(`DELETE FROM outbox WHERE seq IN (${seqs.map(() => "?").join(",")})`, seqs);
    this.schedulePersist();
  }

  /** Moves entries the server refused (validation/ownership) aside, keeping them for inspection. */
  reject(entries: OutboxEntry[], error: string) {
    for (const e of entries) {
      this.db.run(`INSERT OR REPLACE INTO outbox_rejected (seq, entity, row, error) VALUES (?, ?, ?, ?)`, [e.seq, e.entity, JSON.stringify(e.row), error]);
    }
    this.ack(entries.map((e) => e.seq));
  }

  pendingCount(): number {
    const res = this.db.exec(`SELECT COUNT(*) FROM outbox`);
    return Number(res[0]?.values[0]?.[0] ?? 0);
  }

  getMeta(key: string): string | null {
    const res = this.db.exec(`SELECT value FROM meta WHERE key = ?`, [key]);
    return (res[0]?.values[0]?.[0] as string | undefined) ?? null;
  }

  setMeta(key: string, value: string) {
    this.db.run(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, value]);
    this.schedulePersist();
  }

  deviceId(): string {
    let id = this.getMeta("device_id");
    if (!id) {
      id = crypto.randomUUID();
      this.setMeta("device_id", id);
    }
    return id;
  }

  /** Writes the SQLite file to IndexedDB now. */
  async flush() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    if (this.discarded) return;
    await idbPut(fileKey(this.userId), this.db.export());
  }

  close() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    openStores.delete(this);
    if (!this.discarded) this.db.close();
    this.discarded = true;
  }

  /** Stops all future writes (pending and later flushes become no-ops). Used by sign-out. */
  discard() {
    this.close();
  }

  private hasPending(entity: SyncEntity, id: string) {
    const res = this.db.exec(`SELECT 1 FROM outbox WHERE entity = ? AND row_id = ? LIMIT 1`, [entity, id]);
    return res.length > 0;
  }

  private write(entity: SyncEntity, row: Record<string, unknown>) {
    const cols = entityColumns(entity);
    const names = cols.map((c) => quote(camelToSnake(c)));
    this.db.run(
      `INSERT OR REPLACE INTO ${quote(ENTITY_SPECS[entity].table)} (${names.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      toCells(entity, row),
    );
  }

  /** Every mutation ends here: persist soon, and tell subscribers. */
  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => void this.flush(), 250);
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}

/** Deletes a user's offline data from this device (sign-out, ACC-03). */
export async function wipeUserStore(userId: string) {
  // Discard open stores first, or their next flush would write the file back.
  for (const store of [...openStores]) if (store.userId === userId) store.discard();
  await idbDelete(fileKey(userId));
}
