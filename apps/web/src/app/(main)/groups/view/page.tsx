"use client";

import type { GoalView, GroupDetail, PublicPerson } from "@life/shared";
import { ArrowLeft, Check, CircleCheck, Crown, Gift, LogOut, MoreHorizontal, Plus, Send, ShieldCheck, Trash2, UserMinus, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, ConfirmSheet, PopoverMenu, PopoverMenuItem } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { Bar, GroupStreakBadge, GroupTile, goalAmount } from "@/components/groups/group-bits";
import { InviteSheet, NewGoalSheet } from "@/components/groups/group-sheets";
import { Avatar } from "@/components/social/avatar";
import { UsernameSheet } from "@/components/social/profile-form";
import { useApi } from "@/lib/v2/api";
import { useGroup } from "@/lib/v2/use-groups";
import { useSocial } from "@/lib/v2/use-social";
import { useToday } from "@/lib/v2/use-today";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const d = (iso: string) => DAY.format(new Date(`${iso}T12:00:00Z`));

function GoalCard({ goal, meId, onArchive, canEdit }: { goal: GoalView; meId: string | undefined; onArchive: () => void; canEdit: boolean }) {
  const mine = goal.members.find((m) => m.id === meId);
  return (
    <section aria-label={goal.title} className="card space-y-2.5 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-ink">{goal.title}</h3>
          <p className="text-[12px] text-ink-2">
            {goal.mode === "each" ? "Each member" : "Together"} · {d(goal.from)} – {d(goal.to)} ·{" "}
            {goal.finished ? "Finished" : goal.daysLeft === 0 ? "Last day" : `${goal.daysLeft} day${goal.daysLeft === 1 ? "" : "s"} left`}
          </p>
        </div>
        {goal.met ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-done px-2 py-0.5 text-[11.5px] font-medium text-on-fill">
            <Check className="h-3 w-3" aria-hidden /> Met
          </span>
        ) : null}
        {canEdit && !goal.finished ? (
          <button type="button" onClick={onArchive} aria-label={`End ${goal.title}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track">
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {goal.mode === "together" ? (
        <div className="space-y-1">
          <div className="flex justify-between text-[13px]">
            <span className="text-ink">Group total</span>
            <span className="font-semibold text-ink tabular-nums">{goalAmount(goal, goal.total, goal.target)}</span>
          </div>
          <Bar pct={(goal.total / goal.target) * 100} done={goal.met} />
        </div>
      ) : null}
      <ul className="space-y-1.5" aria-label={`${goal.title} progress`}>
        {goal.members.map((m) => (
          <li key={m.id} className="flex items-center gap-2.5">
            <Avatar person={m} size={28} />
            <span className="min-w-0 flex-1 space-y-0.5">
              <span className="flex justify-between gap-2 text-[12.5px]">
                <span className={`truncate ${m.id === meId ? "font-semibold text-ink" : "text-ink"}`}>{m.id === meId ? "You" : m.name}</span>
                <span className="shrink-0 text-ink-2 tabular-nums">
                  {goal.mode === "each" ? goalAmount(goal, m.value, goal.target) : goalAmount(goal, m.value, goal.target).split(" / ")[0]}
                  {m.met ? <CircleCheck className="ml-1 inline h-3.5 w-3.5 text-done" aria-label="met" /> : null}
                </span>
              </span>
              {goal.mode === "each" ? <Bar pct={(m.value / goal.target) * 100} done={m.met} /> : null}
            </span>
          </li>
        ))}
      </ul>
      {goal.reward ? (
        <p className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
          <Gift className="h-3.5 w-3.5" aria-hidden /> {goal.reward}
        </p>
      ) : null}
      <p className="text-[11.5px] text-ink-2">
        {goal.mode === "together" ? "Everyone who helps gets the award and +10 points when it's met." : "Everyone who reaches it gets the award."}
        {mine && !goal.finished ? " Log it from your Today." : ""}
      </p>
    </section>
  );
}

function Group() {
  const params = useSearchParams();
  const id = params.get("id");
  const router = useRouter();
  const api = useApi();
  const { notify } = useAddSheet();
  const { me } = useSocial();
  const today = useToday() ?? new Date().toISOString().slice(0, 10);
  const { data: g, setData, error, reload } = useGroup(id);
  const [inviting, setInviting] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [menu, setMenu] = useState<{ person: PublicPerson; anchor: HTMLElement } | null>(null);
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  const [needName, setNeedName] = useState(false);
  useEffect(() => {
    if (me && !me.username) setNeedName(true); // eslint-disable-line react-hooks/set-state-in-effect -- members recognise each other by name
  }, [me]);

  if (error && !g) {
    return (
      <div className="card space-y-3 p-5 text-center">
        <p className="text-[14px] text-ink">{error}</p>
        <Button onClick={() => router.push("/groups")}>Back to groups</Button>
      </div>
    );
  }
  if (!g) return <div className="skeleton h-48" aria-busy="true" aria-label="Loading group" />;

  const admin = g.role !== "member";
  const snapped = !!me && g.snappedToday.some((p) => p.id === me.id);
  const snap = async () => {
    const r = await api<GroupDetail>(`/v1/groups/${g.id}/snaps`, { body: {} });
    if (!r.ok) return notify({ message: r.message });
    setData(r.data);
    notify({ message: r.data.streak.todayDone ? "Everyone's in today" : `Checked in — ${r.data.memberCount - r.data.snappedToday.length} to go` });
  };
  const roleAction = async (person: PublicPerson, action: "admin" | "member" | "remove") => {
    const r = await api(`/v1/groups/${g.id}/members/${person.id}/${action}`, { body: {} });
    notify({ message: r.ok ? (action === "remove" ? `Removed ${person.name}` : action === "admin" ? `${person.name} is now an admin` : `${person.name} is a member`) : r.message });
    void reload();
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => router.push("/groups")} className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Groups
      </button>
      <header className="card space-y-3 p-4">
        <div className="flex items-center gap-3">
          <GroupTile icon={g.icon} color={g.color} size={52} />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 text-[20px] font-semibold text-ink">
              <span className="truncate">{g.name}</span>
              <GroupStreakBadge streak={g.streak} />
            </h1>
            <p className="text-[12.5px] text-ink-2">
              {g.memberCount} member{g.memberCount === 1 ? "" : "s"} · {g.streak.snappedToday}/{g.memberCount} checked in today
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={snapped} onClick={() => void snap()}>
            <Send className="h-4 w-4" aria-hidden /> {snapped ? "Checked in today" : "Snap the group"}
          </Button>
          {admin ? (
            <Button variant="secondary" onClick={() => setInviting(true)}>
              <UserPlus className="h-4 w-4" aria-hidden /> Invite
            </Button>
          ) : null}
        </div>
        <p className="text-[11.5px] text-ink-2">The group streak grows on days everyone checks in.</p>
      </header>

      <section aria-label="Goals" className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[12px] font-semibold tracking-wide text-ink-2 uppercase">Goals</h2>
          {admin ? (
            <Button size="sm" variant="ghost" onClick={() => setGoalOpen(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> New goal
            </Button>
          ) : null}
        </div>
        {g.goals.length ? (
          g.goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              meId={me?.id}
              canEdit={admin}
              onArchive={() =>
                void api(`/v1/groups/${g.id}/goals/${goal.id}/archive`, { body: {} }).then((r) => {
                  notify({ message: r.ok ? `Ended "${goal.title}"` : r.message });
                  void reload();
                })
              }
            />
          ))
        ) : (
          <p className="card px-4 py-4 text-[13px] text-ink-2">{admin ? "No goals yet — start one, like 70k steps this week." : "No goals yet. The group's admins can start one."}</p>
        )}
      </section>

      <section aria-label="Members" className="card p-2">
        <h2 className="px-2 pt-1 pb-1.5 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">Members</h2>
        <ul className="divide-y divide-border">
          {g.members.map((m) => {
            const role = g.roles[m.id];
            const canManage = admin && m.id !== me?.id && role !== "owner" && (g.role === "owner" || role === "member");
            return (
              <li key={m.id} className="flex items-center gap-3 px-2 py-2">
                <Avatar person={m} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ink">{m.id === me?.id ? `${m.name} (you)` : m.name}</span>
                  {m.username ? <span className="block truncate text-[12px] text-ink-2">@{m.username}</span> : null}
                </span>
                {role === "owner" ? (
                  <span className="inline-flex items-center gap-1 text-[12px] text-ink-2">
                    <Crown className="h-3.5 w-3.5" aria-hidden /> Owner
                  </span>
                ) : role === "admin" ? (
                  <span className="inline-flex items-center gap-1 text-[12px] text-ink-2">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Admin
                  </span>
                ) : null}
                {g.snappedToday.some((p) => p.id === m.id) ? <CircleCheck className="h-4 w-4 text-done" aria-label="checked in today" /> : null}
                {canManage ? (
                  <button type="button" aria-label={`Manage ${m.name}`} onClick={(e) => setMenu({ person: m, anchor: e.currentTarget })} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track">
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setConfirm("leave")}>
          <LogOut className="h-4 w-4" aria-hidden /> Leave group
        </Button>
        {g.role === "owner" ? (
          <Button variant="ghost" onClick={() => setConfirm("delete")}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete group
          </Button>
        ) : null}
      </div>

      {menu ? (
        <PopoverMenu anchor={menu.anchor} onClose={() => setMenu(null)} label={menu.person.name}>
          {g.role === "owner" ? (
            g.roles[menu.person.id] === "admin" ? (
              <PopoverMenuItem icon={<ShieldCheck />} label="Make member" onClick={() => (void roleAction(menu.person, "member"), setMenu(null))} />
            ) : (
              <PopoverMenuItem icon={<ShieldCheck />} label="Make admin" onClick={() => (void roleAction(menu.person, "admin"), setMenu(null))} />
            )
          ) : null}
          <PopoverMenuItem icon={<UserMinus />} label="Remove from group" onClick={() => (void roleAction(menu.person, "remove"), setMenu(null))} />
        </PopoverMenu>
      ) : null}
      {confirm ? (
        <ConfirmSheet
          open
          title={confirm === "leave" ? `Leave ${g.name}?` : `Delete ${g.name}?`}
          body={
            confirm === "leave"
              ? "The group's goals come off your Today; what you logged stays in your history."
              : "The group closes for everyone, and its goals come off their Todays. Their history stays."
          }
          confirmLabel={confirm === "leave" ? "Leave" : "Delete"}
          onConfirm={() =>
            void api(`/v1/groups/${g.id}/${confirm}`, { body: {} }).then((r) => {
              setConfirm(null);
              notify({ message: r.ok ? (confirm === "leave" ? `You left ${g.name}` : `Deleted ${g.name}`) : r.message });
              if (r.ok) router.push("/groups");
            })
          }
          onClose={() => setConfirm(null)}
        />
      ) : null}
      <InviteSheet group={g} open={inviting} onClose={() => setInviting(false)} />
      <UsernameSheet open={needName} onClose={() => setNeedName(false)} onDone={() => void reload()} />
      <NewGoalSheet
        group={g}
        today={today}
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        onSaved={(next) => {
          setGoalOpen(false);
          setData(next);
          notify({ message: "Goal started — it's on everyone's Today" });
        }}
      />
    </div>
  );
}

export default function GroupPage() {
  return (
    <Suspense fallback={null}>
      <Group />
    </Suspense>
  );
}
