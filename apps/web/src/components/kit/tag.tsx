import type { ReactNode } from "react";

export type TagTone = "neutral" | "todo" | "progress" | "done" | "primary";

const TONE: Record<TagTone, string> = {
  neutral: "bg-track text-ink-2",
  todo: "bg-todo text-on-fill",
  progress: "bg-progress text-on-fill",
  done: "bg-done text-on-fill",
  primary: "bg-primary text-on-fill",
};

type TagProps = {
  icon?: ReactNode;
  children: ReactNode;
  tone?: TagTone;
  /** Category pastel (CSS color, e.g. "var(--cat-mint)"); overrides `tone` with ink text. */
  color?: string;
};

/** Small inline label under a task title: category, time, priority, "was due…". */
export function Tag({ icon, children, tone = "neutral", color }: TagProps) {
  return (
    <span
      className={`inline-flex h-5 max-w-full items-center gap-1 rounded-full px-2 text-[11px] leading-none font-medium ${color ? "text-ink" : TONE[tone]}`}
      style={color ? { background: color } : undefined}
    >
      {icon ? (
        <span className="shrink-0 [&_svg]:h-3 [&_svg]:w-3" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
