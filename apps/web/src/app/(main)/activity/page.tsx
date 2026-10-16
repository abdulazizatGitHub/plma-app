"use client";

import { shareSubject, shareText, type ActivityEntry, type ActivityPayload } from "@life/shared";
import { ArrowLeft, HandHeart, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { Avatar } from "@/components/social/avatar";
import { ShareVisual, shareDetail } from "@/components/social/share-card";
import { useApi } from "@/lib/v2/api";
import { useSocial } from "@/lib/v2/use-social";

const WHEN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Activity (SHR-01): what friends shared with you, kudos on yours, and friend requests. */
export default function ActivityPage() {
  const router = useRouter();
  const api = useApi();
  const { notify } = useAddSheet();
  const { refreshUnread } = useSocial();
  const [data, setData] = useState<ActivityPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <h1 className="text-2xl font-semibold text-ink">Activity</h1>
          <p className="text-[13px] text-ink-2">What friends shared with you, and kudos on yours.</p>
        </div>
        <Link href="/friends" className="inline-flex min-h-9 shrink-0 items-center rounded-full px-3 text-[13px] font-medium text-link hover:bg-track">
          Friends
        </Link>
      </header>
      {error && !data ? <p className="card px-3 py-2.5 text-[13px] text-ink-2">{error}</p> : null}
      {!data && !error ? <div className="skeleton h-40" aria-busy="true" aria-label="Loading activity" /> : null}
      {data && !data.entries.length ? (
        <div className="card space-y-3 p-5 text-center">
          <p className="text-[14px] text-ink">Nothing here yet.</p>
          <p className="text-[13px] text-ink-2">When friends share a streak, a perfect day or an award with you, it shows up here.</p>
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
                <>
                  <ShareVisual payload={e.payload} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-ink">{shareText(e.from.name, e.payload)}</p>
                    <p className="text-[12px] text-ink-2">
                      {shareDetail(e.payload) ? `${shareDetail(e.payload)} · ` : ""}
                      {WHEN.format(new Date(e.at))}
                    </p>
                  </div>
                  <Button size="sm" variant={e.kudosSent ? "secondary" : "primary"} disabled={e.kudosSent} onClick={() => void kudos(e)} aria-label={e.kudosSent ? "Kudos sent" : `Send kudos to ${e.from.name}`}>
                    <HandHeart className="mr-1 h-3.5 w-3.5" aria-hidden />
                    {e.kudosSent ? "Sent" : "Kudos"}
                  </Button>
                </>
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
                      {WHEN.format(new Date(e.at))}
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
    </div>
  );
}
