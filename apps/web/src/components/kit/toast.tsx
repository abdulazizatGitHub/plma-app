"use client";

import { X } from "lucide-react";

export type ToastData = { message: string; action?: { label: string; onClick: () => void } };

/** One-line confirmation above the bottom nav, with an optional action (e.g. "View"). */
export function Toast({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-50 flex justify-center px-4 lg:bottom-6">
      <div role="status" aria-live="polite" className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-[14px] bg-ink py-1.5 pr-1.5 pl-3.5 text-[13px] text-bg shadow-[0_8px_24px_rgb(27_26_34/20%)]">
        <span className="min-w-0 flex-1 truncate">{toast.message}</span>
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onClose();
            }}
            className="min-h-8 rounded-[10px] px-3 font-semibold text-bg hover:bg-white/10"
          >
            {toast.action.label}
          </button>
        ) : null}
        <button type="button" aria-label="Dismiss" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-bg/80 hover:bg-white/10">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
