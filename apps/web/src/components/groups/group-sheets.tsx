"use client";

import { GROUP_ICONS, goalDraftSchema, groupDraftSchema, type GoalDraft, type GroupDetail, type GroupIcon } from "@life/shared";
import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { Button, Checkbox, ChipChoice, ColorPicker, DateField, NumberStepper, Sheet, TextField } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { Avatar, PersonLabel } from "@/components/social/avatar";
import { useApi } from "@/lib/v2/api";
import { useFriends } from "@/lib/v2/use-friends";
import { GROUP_ICON, GroupTile } from "./group-bits";

/** New group: name, icon, colour, and whether it's on the public groups board. Save stays disabled until valid. */
export function CreateGroupSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (g: GroupDetail) => void }) {
  const api = useApi();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<GroupIcon>("users");
  const [color, setColor] = useState("sky");
  const [isPublic, setPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = { name: name.trim(), icon, color, visibility: isPublic ? "everyone" : "members" };
  const parsed = groupDraftSchema.safeParse(draft);

  async function save() {
    if (!parsed.success || saving) return;
    setSaving(true);
    setError(null);
    const r = await api<GroupDetail>("/v1/groups", { body: parsed.data });
    setSaving(false);
    if (!r.ok) return setError(r.message);
    setName("");
    onCreated(r.data);
  }

  return (
    <Sheet open={open} onClose={onClose} title="New group">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex items-end gap-3">
          <GroupTile icon={icon} color={color} size={48} />
          <TextField className="flex-1" label="Name" required value={name} maxLength={40} placeholder="e.g. Family, Masjid circle" onChange={(e) => setName(e.target.value)} />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[12px] font-medium text-ink">Icon</legend>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_ICONS.map((k) => {
              const Icon = GROUP_ICON[k];
              return (
                <button
                  key={k}
                  type="button"
                  aria-label={k}
                  aria-pressed={icon === k}
                  onClick={() => setIcon(k)}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${icon === k ? "bg-primary text-on-fill" : "bg-track text-ink hover:bg-border"}`}
                >
                  <Icon className="h-4.5 w-4.5" aria-hidden />
                </button>
              );
            })}
          </div>
        </fieldset>
        <div>
          <p className="mb-1.5 text-[12px] font-medium text-ink">Colour</p>
          <ColorPicker label="Group colour" value={color} onChange={setColor} />
        </div>
        <Checkbox checked={isPublic} onChange={setPublic}>
          Show this group on the public groups board (only its name and average points)
        </Checkbox>
        {error ? (
          <p role="alert" className="text-[12.5px] text-ink">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={!parsed.success || saving}>
          {saving ? "Creating…" : "Create group"}
        </Button>
      </form>
    </Sheet>
  );
}

type Tracking = GoalDraft["tracking"];
type Period = GoalDraft["period"];

/** A group goal: what, each member or together, how it's counted, the target, when. */
export function NewGoalSheet({ group, open, onClose, onSaved, today }: { group: GroupDetail; open: boolean; onClose: () => void; onSaved: (g: GroupDetail) => void; today: string }) {
  const api = useApi();
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<GoalDraft["mode"]>("each");
  const [tracking, setTracking] = useState<Tracking>("quantity");
  const [unit, setUnit] = useState("steps");
  const [target, setTarget] = useState("70000");
  const [period, setPeriod] = useState<Period>("week");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState("");
  const [reward, setReward] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = {
    title: title.trim(),
    mode,
    tracking,
    unit: tracking === "quantity" ? unit.trim() : undefined,
    target: Number(target),
    period,
    from: period === "custom" ? from : undefined,
    to: period === "custom" ? to || undefined : undefined,
    reward: reward.trim() || undefined,
  };
  const parsed = goalDraftSchema.safeParse(draft);
  const issue = (path: string) => (parsed.success ? null : (parsed.error.issues.find((i) => i.path[0] === path)?.message ?? null));

  async function save() {
    if (!parsed.success || saving) return;
    setSaving(true);
    setError(null);
    const r = await api<GroupDetail>(`/v1/groups/${group.id}/goals`, { body: parsed.data });
    setSaving(false);
    if (!r.ok) return setError(r.message);
    setTitle("");
    onSaved(r.data);
  }

  const targetLabel = tracking === "check" ? (mode === "each" ? "Days each" : "Days together") : tracking === "duration" ? "Minutes" : `Target (${unit || "count"})`;
  return (
    <Sheet open={open} onClose={onClose} title={`New goal for ${group.name}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField label="Goal" required value={title} maxLength={60} placeholder="e.g. 70k steps this week" onChange={(e) => setTitle(e.target.value)} error={title ? issue("title") : null} />
        <ChipChoice<GoalDraft["mode"]>
          legend="Who does it"
          value={mode}
          onChange={setMode}
          options={[
            { value: "each", label: "Each member" },
            { value: "together", label: "Together" },
          ]}
        />
        <p className="-mt-1 text-[12px] text-ink-2">
          {mode === "each" ? "Everyone reaches the target on their own." : "The group adds up to the target; everyone who helps gets +10 when it's met."}
        </p>
        <ChipChoice<Tracking>
          legend="Counted as"
          value={tracking}
          onChange={(t) => {
            setTracking(t);
            setTarget(t === "check" ? "5" : t === "duration" ? "150" : "70000");
          }}
          options={[
            { value: "check", label: "Days done" },
            { value: "quantity", label: "A count" },
            { value: "duration", label: "Minutes" },
          ]}
        />
        {tracking === "quantity" ? <TextField label="Unit" required value={unit} maxLength={24} placeholder="steps, pages, km" onChange={(e) => setUnit(e.target.value)} error={unit ? null : issue("unit")} /> : null}
        <NumberStepper label={targetLabel} required value={target} onChange={setTarget} step={tracking === "quantity" ? 1000 : tracking === "duration" ? 30 : 1} min={1} error={target ? issue("target") : "Set a target"} />
        <ChipChoice<Period>
          legend="When"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "week", label: "This week" },
            { value: "month", label: "This month" },
            { value: "custom", label: "Pick dates" },
          ]}
        />
        {period === "custom" ? (
          <div className="grid grid-cols-2 gap-2">
            <DateField label="From" value={from} onChange={setFrom} today={today} min={today} floating />
            <DateField label="To" value={to} onChange={setTo} today={today} min={from || today} floating error={issue("to")} />
          </div>
        ) : null}
        <TextField label="Reward (optional)" value={reward} maxLength={80} placeholder="e.g. Winner picks the dinner" onChange={(e) => setReward(e.target.value)} />
        {error ? (
          <p role="alert" className="text-[12.5px] text-ink">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={!parsed.success || saving}>
          {saving ? "Saving…" : "Start goal"}
        </Button>
      </form>
    </Sheet>
  );
}

/** Invite friends who aren't in the group, or share the group's link (admins). */
export function InviteSheet({ group, open, onClose }: { group: GroupDetail; open: boolean; onClose: () => void }) {
  const api = useApi();
  const { notify } = useAddSheet();
  const { data, loaded } = useFriends();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [code, setCode] = useState<string | null>(group.inviteCode);
  const [sending, setSending] = useState(false);
  const inGroup = new Set(group.members.map((m) => m.id));
  const friends = data.friends.filter((f) => !inGroup.has(f.id));
  const url = code && typeof window !== "undefined" ? `${window.location.origin}/group-invite?code=${code}` : null;

  const getLink = async () => {
    if (code) return code;
    const r = await api<{ code: string }>(`/v1/groups/${group.id}/link`);
    if (r.ok) setCode(r.data.code);
    return r.ok ? r.data.code : null;
  };
  const shareLink = async () => {
    const c = await getLink();
    if (!c) return;
    const link = `${window.location.origin}/group-invite?code=${c}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: group.name, text: `Join ${group.name} on Life`, url: link });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      notify({ message: "Group link copied" });
    } catch {
      notify({ message: link });
    }
  };
  async function send() {
    if (!picked.size || sending) return;
    setSending(true);
    const r = await api<{ invited: number }>(`/v1/groups/${group.id}/invite`, { body: { friendIds: [...picked] } });
    setSending(false);
    notify({ message: r.ok ? `Invited ${r.data.invited}` : r.message });
    if (r.ok) onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Invite to ${group.name}`}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void shareLink()}>
            <Share2 className="h-4 w-4" aria-hidden /> Share group link
          </Button>
          {url ? (
            <Button
              variant="secondary"
              aria-label="Copy group link"
              onClick={() => void navigator.clipboard?.writeText(url).then(() => notify({ message: "Group link copied" }), () => notify({ message: url }))}
            >
              <Copy className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
        </div>
        <p className="text-[12px] text-ink-2">Anyone with the link can join (and sign up first if they need to).</p>
        <h3 className="text-[12px] font-semibold tracking-wide text-ink-2 uppercase">Friends</h3>
        {!loaded ? (
          <div className="skeleton h-20" aria-busy="true" />
        ) : !friends.length ? (
          <p className="text-[13px] text-ink-2">All your friends are already in — or share the link.</p>
        ) : (
          <>
            <ul className="max-h-[38dvh] divide-y divide-border overflow-y-auto rounded-[14px] border border-border">
              {friends.map((f) => {
                const on = picked.has(f.id);
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() =>
                        setPicked((p) => {
                          const n = new Set(p);
                          if (n.has(f.id)) n.delete(f.id);
                          else n.add(f.id);
                          return n;
                        })
                      }
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-track"
                    >
                      <Avatar person={f} size={34} />
                      <PersonLabel person={f} />
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-primary-strong bg-primary-strong text-on-primary-strong" : "border-border"}`} aria-hidden>
                        {on ? <Check className="h-3 w-3" /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button className="w-full" disabled={!picked.size || sending} onClick={() => void send()}>
              {sending ? "Inviting…" : picked.size ? `Invite ${picked.size}` : "Pick friends to invite"}
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
