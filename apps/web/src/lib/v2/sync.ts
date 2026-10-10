import { SYNC_ENTITIES, type SyncPullResponseV2 } from "@life/shared";
import type { LocalStore, OutboxEntry, StoredRow } from "./local-store";

export type SyncResult =
  | { ok: true; pushed: number; pulled: number; rejected: number }
  | { ok: false; reason: "offline" | "signed_out" | "server"; message: string; pushed: number; pulled: number; rejected: number };

type SyncDeps = {
  apiBase: string;
  /** Current access token, or null when signed out. */
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

const CURSOR = "pull_cursor";
const REFUSED = new Set([400, 403, 409, 422]);

class Stop extends Error {
  constructor(readonly reason: "signed_out" | "server", message: string) {
    super(message);
  }
}

/**
 * One sync round (SYSTEM_DESIGN §5.6): push the outbox in batches, then pull
 * everything changed since the last cursor and apply it last-write-wins.
 * Network/server failures keep the outbox for next time. A batch the server
 * refuses (400/403/409/422) is retried row by row so only the bad rows are set
 * aside (kept in `outbox_rejected`) and the rest still sync.
 */
export async function syncOnce(store: LocalStore, { apiBase, getToken, fetchImpl = fetch }: SyncDeps): Promise<SyncResult> {
  let pushed = 0;
  let pulled = 0;
  let rejected = 0;
  const token = await getToken();
  if (!token) return { ok: false, reason: "signed_out", message: "Not signed in", pushed, pulled, rejected };
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  /** Returns null on success, or the server's refusal message. Throws Stop for 401/5xx. */
  const push = async (entries: OutboxEntry[]): Promise<string | null> => {
    const res = await fetchImpl(`${apiBase}/v1/sync/push`, {
      method: "POST",
      headers,
      body: JSON.stringify({ deviceId: store.deviceId(), changes: entries.map((e) => ({ entity: e.entity, row: e.row })) }),
    });
    if (res.status === 401) throw new Stop("signed_out", "Session expired");
    if (REFUSED.has(res.status)) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return body.error?.message ?? `Refused (${res.status})`;
    }
    if (!res.ok) throw new Stop("server", `Push failed (${res.status})`);
    return null;
  };

  try {
    for (let batch = store.outbox(200); batch.length; batch = store.outbox(200)) {
      const refusal = await push(batch);
      if (refusal === null) {
        store.ack(batch.map((e) => e.seq));
        pushed += batch.length;
        continue;
      }
      for (const entry of batch) {
        const one = batch.length === 1 ? refusal : await push([entry]);
        if (one === null) {
          store.ack([entry.seq]);
          pushed += 1;
        } else {
          store.reject([entry], one);
          rejected += 1;
        }
      }
    }

    const since = store.getMeta(CURSOR);
    const res = await fetchImpl(`${apiBase}/v1/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ""}`, { headers });
    if (res.status === 401) throw new Stop("signed_out", "Session expired");
    if (!res.ok) throw new Stop("server", `Pull failed (${res.status})`);
    const data = (await res.json()) as SyncPullResponseV2;
    for (const entity of SYNC_ENTITIES) {
      for (const row of data.changes[entity] ?? []) {
        if (store.applyRemote(entity, row as StoredRow)) pulled += 1;
      }
    }
    store.setMeta(CURSOR, data.serverTime);
    store.setMeta("last_synced_at", new Date().toISOString());
    await store.flush();
    return { ok: true, pushed, pulled, rejected };
  } catch (err) {
    await store.flush().catch(() => undefined);
    if (err instanceof Stop) return { ok: false, reason: err.reason, message: err.message, pushed, pulled, rejected };
    return { ok: false, reason: "offline", message: err instanceof Error ? err.message : "Network error", pushed, pulled, rejected };
  }
}
