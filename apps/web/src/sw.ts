/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    // Detail pages are one precached shell each (/items/view?id=…): match them
    // whatever their app parameters. `_rsc` is deliberately not listed, so
    // Next's data requests never get the HTML shell.
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^(id|add|kind|category|parent|date|time|title|priority)$/],
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

/*
 * Reminders (Phase 6, REM-03). A push shows the notification with Done and
 * Snooze; those buttons post the notification's signed token to the API, so
 * they work without opening the app. Offline, the action waits in IndexedDB
 * and is retried the next time the worker wakes (any push, click or open).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ReminderPush = { title: string; body: string; tag: string; url: string; token: string | null; snoozeMin?: number };
type PendingAction = { token: string; action: "done" | "snooze" };

function outbox<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("life-reminder-actions", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("actions", { autoIncrement: true });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction("actions", mode);
      const req = run(tx.objectStore("actions"));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => open.result.close();
    };
  });
}

async function postAction(a: PendingAction): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/v1/reminders/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) });
    // 4xx (expired, invalid) won't get better by retrying.
    return res.ok || (res.status >= 400 && res.status < 500);
  } catch {
    return false;
  }
}

async function flushActions() {
  const keys = await outbox("readonly", (s) => s.getAllKeys()).catch(() => [] as IDBValidKey[]);
  for (const key of keys) {
    const a = await outbox<PendingAction>("readonly", (s) => s.get(key));
    if (a && (await postAction(a))) await outbox("readwrite", (s) => s.delete(key));
  }
}

async function runAction(a: PendingAction) {
  if (!(await postAction(a))) await outbox("readwrite", (s) => s.add(a)).catch(() => undefined);
}

self.addEventListener("push", (event) => {
  let data: ReminderPush;
  try {
    data = event.data?.json() as ReminderPush;
  } catch {
    data = { title: "Life", body: event.data?.text() ?? "", tag: "life", url: "/", token: null };
  }
  const actions = data.token
    ? [
        { action: "done", title: "Done" },
        { action: "snooze", title: `Snooze ${data.snoozeMin ?? 10} min` },
      ]
    : [];
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        tag: data.tag,
        icon: "/icons/icon.svg",
        badge: "/icons/icon.svg",
        data: { url: data.url, token: data.token },
        // `actions` and `renotify` aren't in every TS lib yet.
        ...({ actions, renotify: true } as object),
      }),
      flushActions(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  const { url, token } = (event.notification.data ?? {}) as { url?: string; token?: string | null };
  event.notification.close();
  if (token && (event.action === "done" || event.action === "snooze")) {
    event.waitUntil(runAction({ token, action: event.action }));
    return;
  }
  event.waitUntil(
    (async () => {
      await flushActions();
      const target = new URL(url ?? "/", self.location.origin).href;
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = open.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        await client.focus();
        if ("navigate" in client) await (client as WindowClient).navigate(target).catch(() => undefined);
      } else await self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | null)?.type === "flush-reminder-actions") event.waitUntil(flushActions());
});
