"use client";

import { shareSubject, type ActivityEntry, type ActivityPayload, type ShareKind } from "@life/shared";
import { ArrowLeft, HandHeart, Send, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { Avatar } from "@/components/social/avatar";
import { ShareSheet, type ShareWhat } from "@/components/social/share-sheet";
import { SnapViewer } from "@/components/social/snap-viewer";
import { useApi } from "@/lib/v2/api";
import { ago } from "@/lib/v2/dates";
import { useSocial } from "@/lib/v2/use-social";

const WHEN_FULL = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** The square by each snap: filled when new, hollow once opened (Snapchat-style). Colour by kind. */
const KIND_COLOR: Record<ShareKind, string> = {
  day: "var(--primary)",
  item_done: "var(--done)",
  streak: "var(--progress)",
  item_streak: "var(--progress)",
  award: "var(--cat-lilac)",
};
const KIND_WORD: Record<ShareKind, string> = { day: "rings", item_done: "check-in", streak: "streak", item_streak: "streak", award: "award" };

function SnapSquare({ kind, opened }: { kind: ShareKind; opened: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-[3px] border-2"
      style={{ borderColor: KIND_COLOR[kind], background: opened ? "transparent" : KIND_COLOR[kind] }}
    />
  );
}

/** Snaps (SHR-01, Snapchat-style): snaps from friends (open once), kudos on yours, and friend requests. */
export default function ActivityPage() {
  const router = useRouter();
  const api = useApi();
  const { notify } = useAddSheet();
  const { refreshUnread } = useSocial();
  const [data, setData] = useState<ActivityPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Extract<ActivityEntry, { type: "share" }> | null>(null);
  const [snap, setSnap] = useState<ShareWhat | null>(null);

  const load = useCallback(async () => {
    const r = await api<ActivityPayload>("/v1/activity");
    if (!r.ok) return setError(r.message);
    setData(r.data);
    if (r.data.unread) {
      await api("/v1/activity/seen", { body: {} });
      void refreshUnread();
    }
  }, [api, refreshUnread]);
  useEffect(() => {
    void load(); // eslint-disable-line react-hooks/set-state-in-effect -- load on open
  }, [load]);

  const kudos = async (e: Extract<ActivityEntry, { type: "share" }>) => {
    setData((d) => (d ? { ...d, entries: d.entries.map((x) => (x.type === "share" && x.id === e.id ? { ...x, kudosSent: true } : x)) } : d));
    const r = await api(`/v1/shares/${e.id}/kudos`, { body: {} });
    if (!r.ok) notify({ message: r.message });
  };
  const snapBack = async (to: string) => {
    const r = await api("/v1/shares", { body: { kind: "day", recipients: [to] } });
    notify({ message: r.ok ? "Snapped back" : r.message });
    return r.ok;
  };
  const accept = async (e: ActivityEntry) => {
    const r = await api(`/v1/friends/${e.from.id}/accept`, { body: {} });
    notify({ message: r.ok ? `You and ${e.from.name} are now friends` : r.message });
    void load();
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </button>
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Snaps</h1>
          <p className="text-[13px] text-ink-2">Snaps open once. Snap each other every day to keep your streaks going.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" onClick={() => setSnap({ kind: "day", label: "today's rings" })}>
            <Send className="h-3.5 w-3.5" aria-hidden /> Snap
          </Button>
          <Link href="/friends" className="inline-flex min-h-8 items-center rounded-full px-2.5 text-[13px] font-medium text-link hover:bg-track">
            Friends
          </Link>
        </div>
      </header>
      {error && !data ? <p className="card px-3 py-2.5 text-[13px] text-ink-2">{error}</p> : null}
      {!data && !error ? <div className="skeleton h-40" aria-busy="true" aria-label="Loading activity" /> : null}
      {data && !data.entries.length ? (
        <div className="card space-y-3 p-5 text-center">
          <p className="text-[14px] text-ink">Nothing here yet.</p>
          <p className="text-[13px] text-ink-2">When friends snap you their rings, a check-in, a streak or an award, it shows up here.</p>
          <Link href="/friends" className="inline-flex min-h-10 items-center rounded-full bg-primary-strong px-4 text-[13px] font-medium text-on-primary-strong">
            Invite a friend
          </Link>
        </div>
      ) : null}
      {data?.entries.length ? (
        <ul className="space-y-2" aria-label="Activity">
          {data.entries.map((e) => (
            <li key={`${e.type}-${e.id}`} className={`card flex items-center gap-3 p-3 ${e.seen ? "" : "ring-2 ring-primary/40"}`}>
              {e.type === "share" ? (
                <button
                  type="button"
                  disabled={e.opened}
                  onClick={() => setViewing(e)}
                  aria-label={`${e.opened ? "Opened" : "New"} snap from ${e.from.name}, ${ago(e.at)}`}
                  className="-m-3 flex min-w-0 flex-1 items-center gap-3 rounded-[inherit] p-3 text-left enabled:hover:bg-track/60"
                >
                  <Avatar person={e.from} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14px] text-ink ${e.opened ? "" : "font-semibold"}`}>{e.from.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-2">
                      <SnapSquare kind={e.kind} opened={e.opened} />
                      {e.opened ? "Opened" : `New ${KIND_WORD[e.kind]} snap — tap to view`} · {ago(e.at)}
                    </span>
                  </span>
                  {e.kudosSent ? <HandHeart className="h-4 w-4 text-progress" aria-label="Kudos sent" /> : null}
                </button>
              ) : e.type === "kudos" ? (
                <>
                  <Avatar person={e.from} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-ink">
                      <b>{e.from.name}</b> sent kudos
                    </p>
                    <p className="truncate text-[12px] text-ink-2">
                      On {shareSubject(e.share)}
                    </p>
                  </div>
                  <HandHeart className="h-5 w-5 text-progress" aria-hidden />
                </>
              ) : (
                <>
                  <Avatar person={e.from} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-ink">{e.type === "request" ? <><b>{e.from.name}</b> wants to be friends</> : <><b>{e.from.name}</b> is now your friend</>}</p>
                    <p className="text-[12px] text-ink-2">
                      {e.from.username ? `@${e.from.username} · ` : ""}
                      {WHEN_FULL.format(new Date(e.at))}
                    </p>
                  </div>
                  {e.type === "request" ? (
                    <Button size="sm" onClick={() => void accept(e)}>
                      <UserPlus className="mr-1 h-3.5 w-3.5" aria-hidden /> Accept
                    </Button>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {viewing ? (
        <SnapViewer
          snapId={viewing.id}
          from={viewing.from}
          kudosSent={viewing.kudosSent}
          onKudos={() => void kudos(viewing)}
          onSnapBack={() => snapBack(viewing.from.id)}
          onClose={(opened) => {
            if (opened) setData((d) => (d ? { ...d, entries: d.entries.map((x) => (x.type === "share" && x.id === viewing.id ? { ...x, opened: true, payload: null } : x)) } : d));
            setViewing(null);
          }}
        />
      ) : null}
      <ShareSheet what={snap} onClose={() => setSnap(null)} />
    </div>
  );
}
