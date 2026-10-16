"use client";

import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { Bar, GroupStreakBadge, GroupTile, goalAmount } from "@/components/groups/group-bits";
import { CreateGroupSheet } from "@/components/groups/group-sheets";
import { Avatar } from "@/components/social/avatar";
import { UsernameSheet } from "@/components/social/profile-form";
import { useApi } from "@/lib/v2/api";
import { useGroups } from "@/lib/v2/use-groups";
import { useSocial } from "@/lib/v2/use-social";

/** Groups (SOC-02/03): mine with their streak and current goal, invites, and "New group". */
export default function GroupsPage() {
  const router = useRouter();
  const api = useApi();
  const { notify } = useAddSheet();
  const { me } = useSocial();
  const { data, offline, reload } = useGroups();
  const [creating, setCreating] = useState(false);
  const [needName, setNeedName] = useState(false);
  // Members recognise each other by name: ask once, the first time (like Friends).
  useEffect(() => {
    if (me && !me.username) setNeedName(true); // eslint-disable-line react-hooks/set-state-in-effect -- first-use nudge
  }, [me]);

  const answer = async (id: string, accept: boolean, name: string) => {
    const r = await api<{ groupId: string }>(`/v1/groups/invites/${id}/${accept ? "accept" : "decline"}`, { body: {} });
    if (!r.ok) return notify({ message: r.message });
    notify({ message: accept ? `You joined ${name}` : "Invite declined" });
    if (accept) router.push(`/groups/view?id=${r.data.groupId}`);
    else void reload();
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/friends"))}
        className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </button>
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Groups</h1>
          <p className="text-[13px] text-ink-2">Family, a class, a masjid circle — set goals together and keep a group streak.</p>
        </div>
        <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => (me && !me.username ? setNeedName(true) : setCreating(true))}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> New group
        </Button>
      </header>
      {offline ? <p className="card px-3 py-2.5 text-[13px] text-ink-2">You&apos;re offline — showing the last copy.</p> : null}

      {data?.invites.length ? (
        <section aria-label="Group invites" className="card p-2">
          <h2 className="px-2 pt-1 pb-1.5 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">Invites</h2>
          <ul className="divide-y divide-border">
            {data.invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-2 py-2">
                <GroupTile icon={i.group.icon} color={i.group.color} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">{i.group.name}</span>
                  <span className="block truncate text-[12px] text-ink-2">
                    {i.from.name} invited you · {i.group.memberCount} member{i.group.memberCount === 1 ? "" : "s"}
                  </span>
                </span>
                <Button size="sm" onClick={() => void answer(i.id, true, i.group.name)}>
                  Join
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void answer(i.id, false, i.group.name)}>
                  Not now
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!data ? (
        <div className="skeleton h-28" aria-busy="true" aria-label="Loading groups" />
      ) : !data.groups.length ? (
        <div className="card space-y-3 p-5 text-center">
          <p className="text-[14px] text-ink">No groups yet.</p>
          <p className="text-[13px] text-ink-2">Start one, set a goal like &ldquo;70k steps this week&rdquo;, and invite friends or share the link.</p>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="My groups">
          {data.groups.map((g) => (
            <li key={g.id}>
              <Link href={`/groups/view?id=${g.id}`} className="card flex items-center gap-3 p-3 hover:bg-track/40">
                <GroupTile icon={g.icon} color={g.color} />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-semibold text-ink">{g.name}</span>
                    <GroupStreakBadge streak={g.streak} />
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="flex -space-x-1.5">
                      {g.members.slice(0, 5).map((m) => (
                        <span key={m.id} className="rounded-full ring-2 ring-surface">
                          <Avatar person={m} size={20} />
                        </span>
                      ))}
                    </span>
                    <span className="text-[12px] text-ink-2">
                      {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                      {g.streak.snappedToday ? ` · ${g.streak.snappedToday} checked in today` : ""}
                    </span>
                  </span>
                  {g.goal ? (
                    <span className="block space-y-0.5">
                      <span className="flex justify-between gap-2 text-[12px]">
                        <span className="truncate text-ink">{g.goal.title}</span>
                        <span className="shrink-0 text-ink-2 tabular-nums">
                          {g.goal.mode === "together" ? goalAmount({ tracking: "quantity", unit: g.goal.unit }, g.goal.total, g.goal.target) : `${g.goal.total}/${g.memberCount} there`}
                        </span>
                      </span>
                      <Bar pct={g.goal.mode === "together" ? (g.goal.total / g.goal.target) * 100 : (g.goal.total / Math.max(1, g.memberCount)) * 100} done={g.goal.met} />
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CreateGroupSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(g) => {
          setCreating(false);
          router.push(`/groups/view?id=${g.id}`);
        }}
      />
      <UsernameSheet open={needName} onClose={() => setNeedName(false)} onDone={() => void reload()} />
    </div>
  );
}
