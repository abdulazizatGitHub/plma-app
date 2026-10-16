"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ChipChoice, Sheet } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { useApi } from "@/lib/v2/api";
import { useSaveSettings, useUserSettings } from "@/lib/v2/use-day";
import { useFriends } from "@/lib/v2/use-friends";
import { Avatar, PersonLabel } from "./avatar";

type Vis = "everyone" | "friends" | "selected" | "private";

const WHAT: Record<Vis, string> = {
  everyone: "Anyone can see your points, streak and awards, and you appear on the Everyone leaderboard.",
  friends: "Your friends see your points, streak and awards. You're not on the Everyone leaderboard.",
  selected: "Only the friends you pick see your points, streak and awards.",
  private: "No one sees your progress, and you're on no leaderboard except your own view.",
};

/**
 * Who can see my progress (SOC-06, owner 2026-10-16): Everyone, Friends,
 * Selected friends or Only me. Items are never shown either way; sharing
 * something with chosen friends always works.
 */
export function VisibilityCard() {
  const settings = useUserSettings();
  const save = useSaveSettings();
  const value = settings.visibility as Vis;
  const [picking, setPicking] = useState(false);
  return (
    <section className="card space-y-3 p-5" aria-label="Who can see my progress">
      <div>
        <h2 className="text-[15px] font-medium text-ink">Who can see my progress</h2>
        <p className="text-[13px] text-ink-2">Others never see your items — only points, streak and awards. Anything you share goes to the friends you choose.</p>
      </div>
      <ChipChoice<Vis>
        legend="Who can see my progress"
        hideLegend
        value={value}
        onChange={(v) => {
          void save({ visibility: v });
          if (v === "selected") setPicking(true);
        }}
        options={[
          { value: "everyone", label: "Everyone" },
          { value: "friends", label: "Friends" },
          { value: "selected", label: "Selected friends" },
          { value: "private", label: "Only me" },
        ]}
      />
      <p className="text-[12.5px] text-ink-2">{WHAT[value] ?? WHAT.friends}</p>
      {value === "selected" ? (
        <button type="button" onClick={() => setPicking(true)} className="min-h-8 rounded-full px-2 text-[13px] font-medium text-link hover:bg-track">
          Choose friends
        </button>
      ) : null}
      {picking ? <AllowSheet onClose={() => setPicking(false)} /> : null}
    </section>
  );
}

function AllowSheet({ onClose }: { onClose: () => void }) {
  const api = useApi();
  const { notify } = useAddSheet();
  const { data, loaded } = useFriends();
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api<{ friendIds: string[] }>("/v1/visibility/allow").then((r) => setPicked(new Set(r.ok ? r.data.friendIds : [])));
  }, [api]);

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function saveList() {
    if (!picked) return;
    setSaving(true);
    const r = await api("/v1/visibility/allow", { method: "PUT", body: { friendIds: [...picked] } });
    setSaving(false);
    notify({ message: r.ok ? (picked.size ? `${picked.size} friend${picked.size === 1 ? "" : "s"} can see your progress` : "No one can see your progress yet") : r.message });
    if (r.ok) onClose();
  }

  return (
    <Sheet open onClose={onClose} title="Who can see my progress">
      {!loaded || !picked ? (
        <div className="skeleton h-24" aria-busy="true" />
      ) : !data.friends.length ? (
        <p className="py-2 text-[13.5px] text-ink-2">Add friends first — then choose who sees your progress.</p>
      ) : (
        <div className="space-y-3">
          <ul className="max-h-[45dvh] divide-y divide-border overflow-y-auto rounded-[14px] border border-border">
            {data.friends.map((f) => {
              const on = picked.has(f.id);
              return (
                <li key={f.id}>
                  <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(f.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-track">
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
          <Button className="w-full" disabled={saving} onClick={() => void saveList()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
