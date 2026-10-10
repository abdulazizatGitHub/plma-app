import { Plus, type LucideIcon } from "lucide-react";
import Link from "next/link";

export type NavItem = { href: string; label: string; icon: LucideIcon };

type BottomNavBarProps = {
  /** Exactly four items: two either side of the center + button. */
  items: [NavItem, NavItem, NavItem, NavItem];
  activeHref: string;
  onAdd: () => void;
  /** Static demo (UI kit): render inline instead of fixed to the viewport. */
  inline?: boolean;
};

/** White bar with a 56px center + (ref 2): Today · Categories · + · Progress · Profile. */
export function BottomNavBar({ items, activeHref, onAdd, inline = false }: BottomNavBarProps) {
  const tab = ({ href, label, icon: Icon }: NavItem) => {
    const active = href === activeHref;
    return (
      <li key={href} className="flex-1">
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium ${
            active ? "text-link" : "text-ink-2 hover:text-ink"
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
          <span>{label}</span>
        </Link>
      </li>
    );
  };
  return (
    <nav
      aria-label="Main"
      className={inline ? "" : "fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]"}
    >
      <ul className="mx-auto flex max-w-lg items-center rounded-t-(--radius-card) bg-surface px-2 pt-1 pb-2 shadow-[0_-4px_16px_rgb(27_26_34/6%)]">
        {items.slice(0, 2).map(tab)}
        <li className="flex flex-1 justify-center">
          <button
            type="button"
            aria-label="Add"
            onClick={onAdd}
            className="press-pop -mt-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-strong text-on-primary-strong shadow-[0_6px_16px_color-mix(in_srgb,var(--primary-strong)_35%,transparent)]"
          >
            <Plus className="h-6 w-6" aria-hidden />
          </button>
        </li>
        {items.slice(2).map(tab)}
      </ul>
    </nav>
  );
}
