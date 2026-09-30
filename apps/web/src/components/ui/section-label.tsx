import type { LucideIcon } from "lucide-react";

type SectionLabelProps = {
  index: string;
  title: string;
  icon?: LucideIcon;
  className?: string;
};

/** by-kin-style numbered section label: `01/ FAITH` followed by a hairline rule. */
export function SectionLabel({ index, title, icon: Icon, className = "" }: SectionLabelProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {Icon ? <Icon className="h-3.5 w-3.5 text-ink-muted" aria-hidden /> : null}
      <h2 className="label-mono text-ink">
        <span className="text-accent-text">{index}/</span> {title}
      </h2>
      <span className="h-px flex-1 bg-line" aria-hidden />
    </div>
  );
}
