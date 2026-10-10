"use client";

import { LogOut, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/kit";
import { useAuth } from "@/components/providers/auth-provider";
import { useStore } from "@/components/providers/store-provider";

/** Signed-in account, v2 sync status and sign-out (wipes this device's copy of the data). */
export function AccountCard() {
  const { user, signOut } = useAuth();
  const { store, syncing, lastResult, syncNow } = useStore();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const status = syncing
    ? "Syncing…"
    : !lastResult
      ? "Not synced yet"
      : lastResult.ok
        ? `Synced${lastResult.rejected ? ` · ${lastResult.rejected} change(s) refused` : ""}`
        : lastResult.reason === "offline"
          ? "Offline — changes are saved on this device"
          : lastResult.message;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[13px] text-ink-2">Signed in as</p>
        <p className="text-[15px] font-medium text-ink">{user?.name ?? user?.email ?? "—"}</p>
        {user?.name ? <p className="text-[13px] text-ink-2">{user.email}</p> : null}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-2" aria-live="polite">
          {status}
          {store && store.pendingCount() ? ` · ${store.pendingCount()} waiting to upload` : ""}
        </p>
        <Button variant="secondary" onClick={() => void syncNow()} disabled={syncing || !store}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Sync
        </Button>
      </div>
      <Button
        variant="secondary"
        className="w-full"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          await signOut();
          router.replace("/sign-in");
        }}
      >
        <LogOut className="h-4 w-4" aria-hidden /> {signingOut ? "Signing out…" : "Sign out"}
      </Button>
      <p className="text-[12px] text-ink-2">Signing out removes your data from this device. It stays safe in your account.</p>
    </div>
  );
}
