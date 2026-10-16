"use client";

import { AlertCircle, Bell, Cloud, CloudOff, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/components/providers/store-provider";
import { useSocial } from "@/lib/v2/use-social";
import { UserMenu } from "./user-menu";

/** Sync state as one icon + label; tapping it syncs now. */
function SyncIndicator() {
  const { store, syncing, lastResult, syncNow } = useStore();
  const pendingCount = store?.pendingCount() ?? 0;
  const { Icon, label } = syncing
    ? { Icon: RefreshCw, label: "Syncing…" }
    : !lastResult
      ? { Icon: Cloud, label: "Not synced yet" }
      : lastResult.ok
        ? { Icon: Cloud, label: pendingCount ? `${pendingCount} change(s) waiting to upload` : "All changes saved" }
        : lastResult.reason === "offline"
          ? { Icon: CloudOff, label: "Offline — changes are saved on this device" }
          : { Icon: AlertCircle, label: `Sync problem: ${lastResult.message}` };
  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      disabled={syncing || !store}
      title={label}
      aria-label={`${label}. Sync now`}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-track hover:text-ink"
    >
      <Icon className={`h-[18px] w-[18px] ${syncing ? "animate-spin" : ""}`} aria-hidden />
    </button>
  );
}

/** Activity (shares, kudos, requests) with an unread dot (Phase 9a). */
function ActivityBell() {
  const { unread } = useSocial();
  return (
    <Link
      href="/activity"
      aria-label={unread ? `Activity, ${unread} new` : "Activity"}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-track hover:text-ink"
    >
      <Bell className="h-[18px] w-[18px]" aria-hidden />
      {unread ? <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full border-2 border-bg bg-todo" aria-hidden /> : null}
    </Link>
  );
}

/** Top bar: app mark, sync status, activity, account menu. Pages keep their own H1. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-xl items-center justify-between px-4 md:max-w-2xl lg:max-w-none lg:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Life — go to Today">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-[13px] font-semibold text-on-fill" aria-hidden>
            L
          </span>
          <span className="text-[15px] font-semibold text-ink">Life</span>
        </Link>
        <div className="flex items-center gap-1">
          <SyncIndicator />
          <ActivityBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
