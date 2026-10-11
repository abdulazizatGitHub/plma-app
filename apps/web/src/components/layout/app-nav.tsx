"use client";

import { Home, LayoutGrid, Plus, TrendingUp, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomNavBar, type NavItem } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";

const ITEMS: [NavItem, NavItem, NavItem, NavItem] = [
  { href: "/", label: "Today", icon: Home },
  { href: "/categories", label: "Categories", icon: LayoutGrid },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/profile", label: "Profile", icon: User },
];

/** Desktop (lg+): the same destinations as a left rail, with Add on top. */
function SideNav({ active, onAdd }: { active: string; onAdd: () => void }) {
  return (
    <nav aria-label="Main" className="fixed top-[calc(env(safe-area-inset-top)+3rem)] bottom-0 left-0 z-30 hidden w-56 flex-col gap-1 px-3 py-4 lg:flex">
      <button
        type="button"
        onClick={onAdd}
        data-tour="add"
        className="press-pop mb-3 flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary-strong text-[13px] font-medium text-on-primary-strong"
      >
        <Plus className="h-4 w-4" aria-hidden /> Add task
      </button>
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const current = href === active;
        return (
          <Link
            key={href}
            data-tour={`nav:${href}`}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-10 items-center gap-3 rounded-(--radius-control) px-3 text-[14px] font-medium ${
              current ? "bg-surface text-link shadow-[0_1px_4px_rgb(27_26_34/6%)]" : "text-ink-2 hover:bg-track hover:text-ink"
            }`}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={current ? 2.25 : 1.75} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Today · Categories · + · Progress · Profile (UI-02): bottom bar on phone/tablet, side rail on desktop. Pending counts as Today. */
export function AppNav() {
  const pathname = usePathname();
  const { openAdd } = useAddSheet();
  const active = ITEMS.find((i) => i.href !== "/" && pathname.startsWith(i.href))?.href ?? "/";
  return (
    <>
      <SideNav active={active} onAdd={openAdd} />
      <div className="lg:hidden">
        <BottomNavBar items={ITEMS} activeHref={active} onAdd={openAdd} />
      </div>
    </>
  );
}
