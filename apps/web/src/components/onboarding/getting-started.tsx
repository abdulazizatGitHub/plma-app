"use client";

import type { DayRings } from "@life/shared";
import { Check, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/components/providers/store-provider";
import { useInstall } from "@/lib/v2/install";
import { useStoreVersion, useUserSettings } from "@/lib/v2/use-day";
import { ONBOARDED_KEY } from "./onboarding-gate";

export const ONBOARDED_AT_KEY = "onboarded_at";
const DISMISSED_KEY = "getting_started";
const DAYS = 14;

type Task = { id: string; label: string; done: boolean; href?: string; onClick?: () => void };

/**
 * "Getting started" on Today for a new account's first two weeks (owner,
 * 2026-10-17): five first steps that tick themselves off as you do them.
 */
export function GettingStarted({ rings, now = Date.now() }: { rings: DayRings; now?: number }) {
  const { store } = useStore();
  const version = useStoreVersion(store);
  const settings = useUserSettings();
  const { installed, openGuide } = useInstall();
  const [hidden, setHidden] = useState(false);

  const state = useMemo(() => {
    if (!store) return null;
    const onboarded = store.getMeta(ONBOARDED_KEY);
    const at = Number(store.getMeta(ONBOARDED_AT_KEY) ?? 0);
    const fresh = (onboarded === "packs" || onboarded === "empty") && at > 0 && now - at < DAYS * 86_400_000;
    if (!fresh || store.getMeta(DISMISSED_KEY) === "dismissed") return null;
    const anyDone = store.query("occurrences", `WHERE "status" = 'done' AND "deleted_at" IS NULL LIMIT 1`).length > 0;
    let friends = 0;
    try {
      friends = (JSON.parse(store.getMeta("social_friends") ?? "{}") as { friends?: unknown[] }).friends?.length ?? 0;
    } catch {
      /* unknown yet */
    }
    return { anyDone, friends };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, now]);

  if (hidden || !state) return null;
  const ringClosed = !!(rings.prayer?.closed || rings.commit?.closed || rings.balance?.closed);
  const tasks: Task[] = [
    { id: "first", label: "Finish your first item", done: state.anyDone },
    { id: "ring", label: "Close a ring", done: ringClosed },
    { id: "prayer", label: "Set your prayer location", done: settings.locationMode !== "unset", href: "/settings/prayer" },
    { id: "friend", label: "Add a friend", done: state.friends > 0, href: "/friends" },
    { id: "install", label: "Install the app", done: installed, onClick: openGuide },
  ];
  const left = tasks.filter((t) => !t.done).length;
  const dismiss = () => {
    store?.setMeta(DISMISSED_KEY, "dismissed");
    setHidden(true);
  };

  return (
    <section aria-label="Getting started" className="card space-y-2 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink">{left ? "Getting started" : "You're all set"}</h2>
          <p className="text-[12.5px] text-ink-2">{left ? `${tasks.length - left} of ${tasks.length} done — a few first steps to get the most out of Life.` : "Nice work. You can hide this now."}</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Hide getting started" className="-mt-1 -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <span className="block h-1.5 overflow-hidden rounded-full bg-track" aria-hidden>
        <span className="block h-full rounded-full bg-done transition-[width]" style={{ width: `${((tasks.length - left) / tasks.length) * 100}%` }} />
      </span>
      <ul className="divide-y divide-border">
        {tasks.map((t) => {
          const body = (
            <>
              <span
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${t.done ? "border-done bg-done text-on-fill" : "border-border"}`}
                aria-hidden
              >
                {t.done ? <Check className="h-3 w-3" /> : null}
              </span>
              <span className={`flex-1 text-[13.5px] ${t.done ? "text-ink-2 line-through" : "text-ink"}`}>{t.label}</span>
              {!t.done && (t.href || t.onClick) ? <ChevronRight className="h-4 w-4 text-ink-2" aria-hidden /> : null}
            </>
          );
          const cls = "flex min-h-10 w-full items-center gap-2.5 text-left";
          return (
            <li key={t.id} aria-label={`${t.label}${t.done ? ", done" : ""}`}>
              {!t.done && t.href ? (
                <Link href={t.href} className={cls}>
                  {body}
                </Link>
              ) : !t.done && t.onClick ? (
                <button type="button" onClick={t.onClick} className={cls}>
                  {body}
                </button>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
