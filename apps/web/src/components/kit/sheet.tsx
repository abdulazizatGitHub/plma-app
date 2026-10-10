"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** Bottom sheet for add / edit / row actions. Escape and backdrop close it. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button, [href], input, select, textarea")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-ink/30" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sheet-in relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-[20px] bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:rounded-[20px] sm:pb-4 sm:shadow-[0_16px_48px_rgb(27_26_34/18%)]"
      >
        <div className="mb-2.5 flex items-center justify-between">
          <h2 id={titleId} className="text-[16px] font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-track"
          >
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A full-width action inside a sheet (e.g. "Move to tomorrow"). */
export function SheetAction({ icon, label, onClick, tone = "default" }: { icon?: ReactNode; label: string; onClick: () => void; tone?: "default" | "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 rounded-(--radius-control) px-3 text-left text-[15px] text-ink hover:bg-track"
    >
      {icon ? <span className="text-ink-2" aria-hidden>{icon}</span> : null}
      {/* The status red fails AA as text, so danger is signalled by a dot, not the label color. */}
      {tone === "danger" ? <span className="h-2.5 w-2.5 rounded-full bg-todo" aria-hidden /> : null}
      {label}
    </button>
  );
}
