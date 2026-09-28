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
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]"
      aria-label="Main"
    >
      <ul
        className="glass-nav flex max-w-lg flex-1 items-stretch justify-around gap-0.5 rounded-[28px] px-1.5 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      >
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
                className={`flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors ${
                  active ? "bg-accent/15 text-accent" : "text-ink-muted hover:text-ink"
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
