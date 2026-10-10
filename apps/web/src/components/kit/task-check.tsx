import { Check } from "lucide-react";
import type { ItemState } from "./status-tile";

type TaskCheckProps = {
  state: ItemState;
  /** Accessible name, e.g. "Gym — Push day". */
  label: string;
  onToggle?: () => void;
  disabled?: boolean;
};

/** 28px round check inside a 44px hit area: empty, half (in progress), filled (done). */
export function TaskCheck({ state, label, onToggle, disabled }: TaskCheckProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === "done" ? true : state === "in_progress" ? "mixed" : false}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="press-pop -m-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
    >
      <span
        aria-hidden
        className={`transition-token flex h-6 w-6 items-center justify-center rounded-full border-2 ${
          state === "done"
            ? "border-done bg-done text-on-fill"
            : state === "in_progress"
              ? "border-progress"
              : "border-ink-2"
        }`}
        style={
          state === "in_progress"
            ? { background: "conic-gradient(var(--progress) 0 50%, transparent 50% 100%)" }
            : undefined
        }
      >
        {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}
