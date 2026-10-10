"use client";

import { CalendarClock, LogOut, RefreshCw, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SegmentedTabs, ThemeSwatches } from "@/components/kit";
import { useAuth } from "@/components/providers/auth-provider";
import { useStore } from "@/components/providers/store-provider";
import { useTheme } from "@/components/providers/theme-provider";
import type { ThemeMode } from "@/lib/theme/theme-utils";
import { usePending } from "@/lib/v2/use-day";

/** "Abdul Aziz" → "AA"; falls back to the email's first letter. */
export function initialsFor(name: string | null, email: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length) return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
  return (email?.[0] ?? "?").toUpperCase();
}

function MenuLink({ href, icon, children, onClick }: { href: string; icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex min-h-9 items-center gap-2.5 rounded-(--radius-control) px-2.5 text-[13px] text-ink hover:bg-track">
      <span className="text-ink-2" aria-hidden>
        {icon}
      </span>
      {children}
    </Link>
  );
}

/**
 * Avatar button + account panel: profile, pending, theme, appearance, sync,
 * sign out. A dialog (it mixes swatches and controls, so not an ARIA menu).
 */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const { syncNow, syncing } = useStore();
  const { theme, setTheme, mode, setMode } = useTheme();
  const pending = usePending();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]); // eslint-disable-line react-hooks/set-state-in-effect -- close on navigation

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    root.current?.querySelector<HTMLElement>(`#${CSS.escape(panelId)} a, #${CSS.escape(panelId)} button`)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, panelId]);

  if (!user) return null;
  const initials = initialsFor(user.name, user.email);
  const close = () => setOpen(false);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Account menu for ${user.name ?? user.email ?? "you"}`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-on-fill">{initials}</span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Account"
          className="card absolute top-full right-0 z-50 mt-1 w-[min(16.5rem,calc(100vw-1.5rem))] space-y-0.5 p-1.5"
        >
          <div className="flex items-center gap-2.5 px-2.5 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-on-fill" aria-hidden>
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink">{user.name ?? "Your account"}</p>
              <p className="truncate text-[11.5px] text-ink-2">{user.email}</p>
            </div>
          </div>
          <hr className="border-border" />
          <MenuLink href="/profile" icon={<UserRound className="h-4 w-4" />} onClick={close}>
            Profile &amp; settings
          </MenuLink>
          <MenuLink href="/pending" icon={<CalendarClock className="h-4 w-4" />} onClick={close}>
            <span className="flex-1">Pending</span>
            <span className="text-[12px] text-ink-2">{pending.length}</span>
          </MenuLink>
          <hr className="border-border" />
          <div className="space-y-1.5 px-1 py-1.5">
            <p className="px-1.5 text-[12px] font-medium text-ink-2">Theme</p>
            <ThemeSwatches value={theme} onChange={setTheme} />
            <SegmentedTabs<ThemeMode>
              label="Appearance"
              value={mode}
              onChange={setMode}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          </div>
          <hr className="border-border" />
          <button
            type="button"
            disabled={syncing}
            onClick={() => void syncNow()}
            className="flex min-h-9 w-full items-center gap-2.5 rounded-(--radius-control) px-2.5 text-left text-[13px] text-ink hover:bg-track"
          >
            <RefreshCw className={`h-4 w-4 text-ink-2 ${syncing ? "animate-spin" : ""}`} aria-hidden />
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <button
            type="button"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await signOut();
              router.replace("/sign-in");
            }}
            className="flex min-h-9 w-full items-center gap-2.5 rounded-(--radius-control) px-2.5 text-left text-[13px] text-ink hover:bg-track"
          >
            <LogOut className="h-4 w-4 text-ink-2" aria-hidden />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
