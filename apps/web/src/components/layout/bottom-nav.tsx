"use client";

import {
  CalendarDays,
  Home,
  MoreHorizontal,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/goals", label: "Goals", icon: Sparkles },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/more", label: "More", icon: MoreHorizontal },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium transition-colors ${
                  active ? "text-accent" : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "stroke-[2.5px]" : ""}`}
                  aria-hidden
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
