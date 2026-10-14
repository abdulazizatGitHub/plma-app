"use client";

import { RefreshCw } from "lucide-react";

/** Shown on history screens until this device's first sync finishes, so empty numbers don't read as lost history. */
export function SyncingNote() {
  return (
    <p role="status" className="card flex items-center gap-2 px-3 py-2.5 text-[13px] text-ink-2">
      <RefreshCw className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
      Syncing your history — numbers will fill in shortly.
    </p>
  );
}
