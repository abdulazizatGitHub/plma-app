import Link from "next/link";
import type { ReactNode } from "react";

/** Simple reading layout for the Terms and Privacy pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10">
      <Link href="/sign-up" className="inline-flex min-h-11 items-center text-[14px] font-medium text-link">
        ← Back
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-1 text-[13px] text-ink-2">Last updated {updated} · Draft — the owner will finalise this text before public launch.</p>
      <div className="card mt-6 space-y-4 p-6 text-[15px] leading-relaxed text-ink [&_h2]:mt-2 [&_h2]:text-[17px] [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
