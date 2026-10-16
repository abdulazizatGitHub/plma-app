"use client";

import { useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string };

/** Authenticated JSON calls to the API; never throws (offline → status 0). */
export function useApi() {
  const { getAccessToken } = useAuth();
  return useCallback(
    async <T,>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> => {
      try {
        const token = await getAccessToken();
        if (!token) return { ok: false, status: 401, code: "signed_out", message: "Sign in again." };
        const res = await fetch(`${API_BASE}${path}`, {
          method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        });
        const data = (await res.json().catch(() => null)) as T & { error?: { code?: string; message?: string } };
        if (!res.ok) return { ok: false, status: res.status, code: data?.error?.code ?? "error", message: data?.error?.message ?? `Something went wrong (${res.status}).` };
        return { ok: true, data };
      } catch {
        return { ok: false, status: 0, code: "offline", message: "You're offline — try again when you're connected." };
      }
    },
    [getAccessToken],
  );
}
