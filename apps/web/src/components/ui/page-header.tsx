import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  /** Right-aligned controls on the eyebrow row (e.g. refresh). */
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <p className="label-mono text-ink-muted">{eyebrow}</p>
        {actions}
      </div>
      <h1 className="font-display text-[2.75rem] leading-[0.95] font-semibold tracking-[-0.04em] text-ink">
        {title}
      </h1>
      {description ? <p className="mt-2 text-sm text-ink-muted">{description}</p> : null}
    </header>
  );
}
