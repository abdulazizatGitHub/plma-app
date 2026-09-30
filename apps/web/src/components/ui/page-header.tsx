import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Controls on the title row (e.g. refresh). */
  actions?: ReactNode;
};

/** Page title — no eyebrow above it; the title stands on its own. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[2.75rem] leading-[0.95] font-semibold tracking-[-0.04em] text-ink">
          {title}
        </h1>
        {actions}
      </div>
      {description ? <p className="mt-2 text-sm text-ink-muted">{description}</p> : null}
    </header>
  );
}
