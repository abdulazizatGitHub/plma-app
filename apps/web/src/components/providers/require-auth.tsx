"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./auth-provider";

/** localStorage keys left by the v1 app (shared SQLite cache, old theme presets). */
function removeV1Leftovers() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("life_sqlite_v1") || key === "life_theme_name" || key === "life_theme_accent") {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage unavailable (private mode): nothing to clean.
  }
}

/** Guards the signed-in area; signed-out visitors go to /sign-in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed_out") router.replace("/sign-in");
    if (status === "signed_in") removeV1Leftovers();
  }, [status, router]);

  if (status !== "signed_in") {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
        <span className="text-[13px] text-ink-2">{status === "signed_out" ? "Redirecting to sign in…" : "Loading…"}</span>
      </div>
    );
  }
  return <>{children}</>;
}
