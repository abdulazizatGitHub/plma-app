"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/components/providers/store-provider";

export const ONBOARDED_KEY = "onboarded";

/**
 * Sends a brand-new account to the starter-pack picker once (owner decision
 * 2026-10-10: new accounts with no categories only). Waits for a successful
 * first sync, so an existing account on a new device is never mistaken for a
 * new one.
 */
export function OnboardingGate() {
  const { store, lastResult } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!store || !lastResult?.ok || pathname === "/welcome") return;
    if (store.getMeta(ONBOARDED_KEY)) return;
    const hasData =
      store.query("categories", `WHERE "deleted_at" IS NULL LIMIT 1`).length > 0 || store.query("items", `WHERE "deleted_at" IS NULL LIMIT 1`).length > 0;
    if (hasData) store.setMeta(ONBOARDED_KEY, "existing");
    else router.replace("/welcome");
  }, [store, lastResult, pathname, router]);

  return null;
}
