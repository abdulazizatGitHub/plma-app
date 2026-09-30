type SectionLabelProps = {
  title: string;
  className?: string;
};

/** A plain section heading — no number, no mono eyebrow styling. */
export function SectionLabel({ title, className = "" }: SectionLabelProps) {
  return (
    <h2
      className={`font-display text-xl leading-tight font-semibold tracking-[-0.02em] text-ink ${className}`}
    >
      {title}
    </h2>
  );
}
