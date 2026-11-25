"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useSocial } from "@/lib/v2/use-social";

/** Notifications (snaps, kudos, friend requests) with an unread dot (Phase 9a). */
function NotificationsBell() {
  const { unread } = useSocial();
  return (
    <Link
      href="/activity"
      data-tour="activity"
      aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-track"
    >
      <Bell className="h-5.5 w-5.5" strokeWidth={1.75} aria-hidden />
      {unread ? <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-todo" aria-hidden /> : null}
    </Link>
  );
}

/**
 * Top bar (owner, 2026-11-25): the logo and the notifications bell — nothing
 * else. Theme, sync and sign-out live in Profile; snapping your day lives on
 * the notifications page. Pages keep their own H1.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-xl items-center justify-between px-4 md:max-w-2xl lg:max-w-none lg:px-6">
        <Link href="/" className="flex items-center" aria-label="Mehrmah — go to Today">
          <BrandLogo />
        </Link>
        <NotificationsBell />
      </div>
    </header>
  );
}
