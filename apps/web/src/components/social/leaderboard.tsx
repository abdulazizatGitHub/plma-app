"use client";

import type { LeaderboardPayload } from "@life/shared";
import { Medal } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SegmentedTabs } from "@/components/kit";
import { useStore } from "@/components/providers/store-provider";
import { useApi } from "@/lib/v2/api";
import { Avatar } from "./avatar";

type Board = "friends" | "everyone";
type Period = "week" | "month";

const MEDAL = ["var(--cat-yellow)", "var(--track)", "var(--cat-peach)"];
const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Leaderboards (SOC-04, owner 2026-10-16): Friends or Everyone, by points,
 * for the period Progress shows (this week or this month). Shows only names,
 * avatars and points.
 */
export function Leaderboard({ period }: { period: Period }) {
  const api = useApi();
  const { store } = useStore();
  const [board, setBoard] = useState<Board>("friends");
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const key = `social_board_${board}_${period}`;
    let live = true;
    void api<LeaderboardPayload>(`/v1/leaderboard?board=${board}&period=${period}`).then((r) => {
      if (!live) return;
      if (r.ok) {
        setData(r.data);
        setOffline(false);
        store?.setMeta(key, JSON.stringify(r.data));
      } else {
        setOffline(r.status === 0);
        try {
          const raw = store?.getMeta(key);
          setData(raw ? (JSON.parse(raw) as LeaderboardPayload) : null);
        } catch {
          setData(null);
        }
      }
    });
    return () => {
      live = false;
    };
  }, [api, store, board, period]);

  const onlyMe = data && board === "friends" && data.rows.length <= 1;
  return (
    <section aria-label="Leaderboard" className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-medium text-ink">Leaderboard · this {period}</h2>
        <Link href="/friends" className="inline-flex min-h-8 items-center rounded-full px-2 text-[12.5px] font-medium text-link hover:bg-track">
          Friends
        </Link>
      </div>
      <SegmentedTabs<Board>
        label="Board"
        value={board}
        onChange={setBoard}
        options={[
          { value: "friends", label: "Friends" },
          { value: "everyone", label: "Everyone" },
        ]}
      />
      {offline ? <p className="text-[12px] text-ink-2">Offline — showing the last copy.</p> : null}
      {!data ? (
        <div className="skeleton h-24" aria-busy="true" aria-label="Loading leaderboard" />
      ) : (
        <>
          {data.rows.length ? (
            <ol className="divide-y divide-border" aria-label={`${board === "friends" ? "Friends" : "Everyone"} this ${period}`}>
              {data.rows.map((r) => (
                <li key={r.id} className={`flex items-center gap-3 py-2 ${r.you ? "-mx-2 rounded-[12px] bg-track px-2" : ""}`} aria-label={`${r.rank}. ${r.name}${r.you ? " (you)" : ""}, ${r.points} points`}>
                  <span className="w-6 text-center text-[13px] font-semibold text-ink-2 tabular-nums">
                    {r.rank <= 3 && r.points > 0 ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-ink" style={{ background: MEDAL[r.rank - 1] }} aria-hidden>
                        <Medal className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      r.rank
                    )}
                  </span>
                  <Avatar person={r} size={32} />
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                    {r.name}
                    {r.you ? <span className="text-ink-2"> · you</span> : null}
                  </span>
                  <span className="text-[14px] font-semibold text-ink tabular-nums">{fmt(r.points)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-ink-2">No one has points yet this {period}.</p>
          )}
          {data.hidden ? (
            <p className="text-[12.5px] text-ink-2">
              You&apos;re not on the Everyone board.{" "}
              <Link href="/profile" className="font-medium text-link">
                Change who can see you
              </Link>
            </p>
          ) : null}
          {onlyMe ? (
            <p className="text-[12.5px] text-ink-2">
              It&apos;s just you so far.{" "}
              <Link href="/friends" className="font-medium text-link">
                Invite a friend
              </Link>
            </p>
          ) : null}
          <p className="text-[11.5px] text-ink-2">Top three each week and month earn a medal award.</p>
        </>
      )}
    </section>
  );
}
