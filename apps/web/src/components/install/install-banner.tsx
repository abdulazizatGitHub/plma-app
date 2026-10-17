"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useInstall } from "@/lib/v2/install";

/**
 * A slim bar above the top menu (owner, 2026-10-17): "Install Life" until it's
 * installed. Install opens the browser's prompt where there is one, else the
 * step-by-step guide. Dismissed, it comes back after two weeks.
 */
export function InstallBanner() {
  const { bannerVisible, dismissBanner, install, canPrompt } = useInstall();
  // First-run setup has its own install step.
  const setup = usePathname() === "/welcome";
  if (!bannerVisible || setup) return null;
  return (
    <div role="region" aria-label="Install the app" className="bg-primary-strong text-on-primary-strong">
      <div className="mx-auto flex w-full max-w-xl items-center gap-2.5 px-4 pt-[calc(env(safe-area-inset-top)+6px)] pb-1.5 md:max-w-2xl lg:max-w-none lg:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
        <img src="/icons/icon-192.png" alt="" width={28} height={28} className="shrink-0 rounded-[8px] ring-1 ring-white/30" />
        <p className="min-w-0 flex-1 text-[12.5px] leading-tight">
          <b>Install Life</b> <span className="opacity-85">— works offline and sends reminders.</span>
        </p>
        <button type="button" onClick={() => void install()} className="shrink-0 rounded-full bg-on-primary-strong px-3 py-1 text-[12.5px] font-semibold text-primary-strong hover:opacity-90">
          {canPrompt ? "Install" : "How to install"}
        </button>
        <button type="button" onClick={dismissBanner} aria-label="Not now" className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-white/15">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
