type PhaseNoticeProps = {
  phase: string;
  title: string;
  description: string;
};

/** Marks a screen (or section) that's designed but not yet built — a page number for the roadmap, not a decoration. */
export function PhaseNotice({ phase, title, description }: PhaseNoticeProps) {
  return (
    <div className="flex items-start gap-4 border-t-2 border-ink/10 pt-6">
      <span className="font-display text-5xl leading-none text-ink/15" aria-hidden>
        {phase}
      </span>
      <div className="pt-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>
    </div>
  );
}
