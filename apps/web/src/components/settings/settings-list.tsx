import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Grouped settings, like iOS Settings (owner, 2026-10-17): a small heading,
 * then one card of rows. Every row: a pastel icon tile, a label, the current
 * value on the right, and a chevron when it opens something.
 */
export function SettingsGroup({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-1.5">
      <h2 className="px-1 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">{title}</h2>
      <ul className="card divide-y divide-border overflow-hidden">{children}</ul>
      {footer ? <p className="px-1 text-[12px] text-ink-2">{footer}</p> : null}
    </section>
  );
}

type RowProps = {
  icon: ReactNode;
  /** Category pastel name: mint, sky, lilac, peach, pink, yellow, lime, teal. */
  tone: string;
  label: string;
  value?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Extra content on the right instead of a chevron (e.g. a button). */
  trailing?: ReactNode;
};

export function SettingsRow({ icon, tone, label, value, href, onClick, trailing }: RowProps) {
  const body = (
    <>
      <span aria-hidden className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-ink [&>svg]:h-4 [&>svg]:w-4" style={{ background: `var(--cat-${tone})` }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-[14px] font-medium text-ink">{label}</span>
      {value !== undefined ? <span className="max-w-[55%] truncate text-right text-[13px] text-ink-2">{value}</span> : null}
      {trailing ?? (href || onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-ink-2" aria-hidden /> : null)}
    </>
  );
  const cls = "flex min-h-13 w-full items-center gap-3 px-3.5 py-2 text-left";
  return (
    <li>
      {href ? (
        <Link href={href} className={`${cls} hover:bg-track/60`}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={`${cls} hover:bg-track/60`}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}
