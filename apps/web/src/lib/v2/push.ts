"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";

/*
 * Web Push on this device (REM-05). The browser asks for permission once; the
 * subscription goes to the API, which sends reminders to every device the
 * user turned them on for.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type PushState =
  /** No service worker / Push API (old browser, or dev mode without the worker). */
  | "unsupported"
  /** iPhone/iPad Safari: push only works once the app is on the Home Screen. */
  | "ios-install"
  | "denied"
  | "off"
  | "on";

type Nav = Navigator & { standalone?: boolean };

export function isIosBrowser(nav: Nav = navigator): boolean {
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  const standalone = nav.standalone === true || (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches);
  return ios && !standalone;
}

function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) return null;
  return navigator.serviceWorker.ready;
}

async function readState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (isIosBrowser()) return "ios-install";
  if (!("PushManager" in window) || !("Notification" in window)) return "unsupported";
  const reg = await registration();
  if (!reg) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** This device's push state, plus turning it on/off and sending a test. */
export function usePush() {
  const { getAccessToken } = useAuth();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => readState().then(setState, () => setState("unsupported")), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: { message?: string } }).error?.message ?? `Request failed (${res.status})`);
      return body as Record<string, unknown>;
    },
    [getAccessToken],
  );

  const turnOn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await registration();
      if (!reg) throw new Error("This browser can't receive notifications here.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const { publicKey } = (await api("/v1/push/key")) as { publicKey: string };
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) }));
      await api("/v1/push/subscriptions", { method: "POST", body: JSON.stringify(sub.toJSON()) });
      setState("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn on notifications.");
    } finally {
      setBusy(false);
    }
  }, [api]);

  const turnOff = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const sub = await (await registration())?.pushManager.getSubscription();
      if (sub) {
        await api("/v1/push/subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }, [api]);

  const sendTest = useCallback(async () => {
    setError(null);
    try {
      await api("/v1/push/test", { method: "POST", body: "{}" });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send a test.");
      return false;
    }
  }, [api]);

  const upcoming = useCallback(async () => {
    const r = (await api("/v1/reminders/upcoming")) as { upcoming: { title: string; at: string; kind: string }[] };
    return r.upcoming;
  }, [api]);

  return { state, busy, error, turnOn, turnOff, sendTest, upcoming, refresh };
}
