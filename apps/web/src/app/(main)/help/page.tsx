"use client";

import { ArrowLeft, Bell, BookOpen, CalendarRange, CircleHelp, Download, LayoutGrid, Moon, Plus, Search, Shield, Trophy, Users, UsersRound, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { HELP, searchText, type HelpSection } from "@/lib/help/content";
import { useInstall } from "@/lib/v2/install";

const ICON: Record<HelpSection["icon"], { icon: ReactNode; tone: string }> = {
  start: { icon: <BookOpen />, tone: "sky" },
  today: { icon: <LayoutGrid />, tone: "mint" },
  add: { icon: <Plus />, tone: "lime" },
  prayer: { icon: <Moon />, tone: "lilac" },
  plan: { icon: <CalendarRange />, tone: "teal" },
  bell: { icon: <Bell />, tone: "yellow" },
  progress: { icon: <Trophy />, tone: "peach" },
  friends: { icon: <Users />, tone: "pink" },
  groups: { icon: <UsersRound />, tone: "mint" },
  privacy: { icon: <Shield />, tone: "lilac" },
  offline: { icon: <WifiOff />, tone: "sky" },
  install: { icon: <Download />, tone: "teal" },
};

/** "**Profile**" → bold. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") ? (
          <b key={i} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </b>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** App guide (owner, 2026-10-17): short articles by topic, with search. */
export default function HelpPage() {
  const router = useRouter();
  const { openGuide } = useInstall();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const sections = useMemo(
    () => (query ? HELP.map((s) => ({ ...s, articles: s.articles.filter((a) => searchText(s, a).includes(query)) })).filter((s) => s.articles.length) : HELP),
    [query],
  );

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/profile"))}
        className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </button>
      <header>
        <h1 className="text-2xl font-semibold text-ink">App guide</h1>
        <p className="text-[13px] text-ink-2">How Life works, in short answers.</p>
      </header>
      <label className="flex h-11 items-center gap-2 rounded-[14px] border border-border bg-surface px-3">
        <Search className="h-4 w-4 text-ink-2" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search — e.g. qada, streak, install"
          aria-label="Search the guide"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-2"
        />
      </label>
      {!sections.length ? (
        <p className="card flex items-center gap-2 px-4 py-4 text-[13px] text-ink-2">
          <CircleHelp className="h-4 w-4" aria-hidden /> Nothing matches &ldquo;{q}&rdquo;.
        </p>
      ) : null}
      {sections.map((s) => (
        <section key={s.id} aria-label={s.title} className="space-y-1.5">
          <h2 className="flex items-center gap-2 px-1 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">
            <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center rounded-[8px] text-ink [&>svg]:h-3.5 [&>svg]:w-3.5" style={{ background: `var(--cat-${ICON[s.icon].tone})` }}>
              {ICON[s.icon].icon}
            </span>
            {s.title}
          </h2>
          <div className="card divide-y divide-border overflow-hidden">
            {s.articles.map((a) => (
              <details key={a.id} open={!!query} className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[14px] font-medium text-ink hover:bg-track/60 [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{a.q}</span>
                  <span aria-hidden className="text-ink-2 transition-transform group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <div className="space-y-2 px-4 pb-3 text-[13.5px] leading-relaxed text-ink-2">
                  {a.a.map((p, i) => (
                    <p key={i}>
                      <Rich text={p} />
                    </p>
                  ))}
                  {s.id === "install" ? (
                    <button type="button" onClick={openGuide} className="min-h-8 rounded-full px-2 text-[13px] font-medium text-link hover:bg-track">
                      Show me step by step
                    </button>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
