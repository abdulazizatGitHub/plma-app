"use client";

import initSqlJs, { type Database, type SqlValue } from "sql.js";
import { LOCAL_DB_SCHEMA } from "./schema-sql";

const STORAGE_KEY = "life_sqlite_v1";

let dbPromise: Promise<Database> | null = null;

function persist(db: Database) {
  if (typeof window === "undefined") return;
  const binary = db.export();
  const bytes = Array.from(new Uint8Array(binary));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bytes));
}

async function loadDb(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file) => `/${file}`,
  });

  let db: Database;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const bytes = new Uint8Array(JSON.parse(raw) as number[]);
    db = new SQL.Database(bytes);
    db.run(LOCAL_DB_SCHEMA);
  } else {
    db = new SQL.Database();
    db.run(LOCAL_DB_SCHEMA);
    db.run(
      "INSERT INTO meta (key, value) VALUES ('schema_version', '1')",
    );
    persist(db);
  }

  return db;
}

export function getLocalDb(): Promise<Database> {
  if (!dbPromise) dbPromise = loadDb();
  return dbPromise;
}

export function runPersisted(db: Database, sql: string, params?: SqlValue[]) {
  if (params) db.run(sql, params);
  else db.run(sql);
  persist(db);
}

export function getMeta(db: Database, key: string): string | null {
  const stmt = db.prepare("SELECT value FROM meta WHERE key = ?");
  stmt.bind([key]);
  const row = stmt.step() ? (stmt.getAsObject() as { value: string }) : null;
  stmt.free();
  return row?.value ?? null;
}

export function setMeta(db: Database, key: string, value: string) {
  runPersisted(
    db,
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export function getOrCreateDeviceId(db: Database): string {
  const existing = getMeta(db, "device_id");
  if (existing) return existing;
  const id = crypto.randomUUID();
  setMeta(db, "device_id", id);
  return id;
}
