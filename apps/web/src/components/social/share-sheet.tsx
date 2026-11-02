"use client";

import type { ShareKind } from "@life/shared";
import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Sheet } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { useApi } from "@/lib/v2/api";
import { useFriends } from "@/lib/v2/use-friends";
import { useSocial } from "@/lib/v2/use-social";
import { Avatar, PersonLabel } from "./avatar";
import { UsernameSheet } from "./profile-form";
import { StreakBadge } from "./streak-badge";

export type ShareWhat = { kind: ShareKind; awardId?: string; itemId?: string; date?: string; label: string; to?: string[] };

/**
 * The snap sheet (SHR-01, Snapchat-style, owner 2026-10-16): pick friends and
 * send. Friends with a streak about to end come first, each with its 🔥.
 * Sharing ignores visibility — you choose who gets it. "Send" stays disabled
 * until someone is picked.
 */
export function ShareSheet({ what, onClose }: { what: ShareWhat | null; onClose: () => void }) {
  // Mounted only while open, so friends are fetched when it's actually used.
  return what ? <ShareSheetOpen what={what} onClose={onClose} /> : null;
}

function ShareSheetOpen({ what, onClose }: { what: ShareWhat; onClose: () => void }) {
  const { me } = useSocial();
  const api = useApi();
  const { notify } = useAddSheet();
  const { data, loaded } = useFriends();
  const [picked, setPicked] = useState<Set<string>>(new Set(what.to ?? []));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needName, setNeedName] = useState(false);

  useEffect(() => {
    setNeedName(!!me && !me.username); // eslint-disable-line react-hooks/set-state-in-effect -- ask for a username first
  }, [me]);

  if (needName) return <UsernameSheet open onClose={onClose} onDone={() => setNeedName(false)} />;

  const friends = data.friends;
  const all = friends.length > 0 && picked.size === friends.length;
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function send() {
    if (!picked.size || sending) return;
    setSending(true);
    setError(null);
    const r = await api<{ id: string }>("/v1/shares", { body: { kind: what.kind, awardId: what.awardId, itemId: what.itemId, date: what.date, recipients: [...picked] } });
    setSending(false);
    if (!r.ok) return setError(r.message);
    notify({ message: `Snapped ${picked.size === 1 ? friends.find((f) => picked.has(f.id))?.name : `${picked.size} friends`}` });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={`Snap ${what.label}`}>
      {!loaded ? (
        <div className="skeleton h-24" aria-busy="true" />
      ) : friends.length === 0 ? (
        <div className="space-y-3 py-2 text-center">
          <p className="text-[13.5px] text-ink">Add a friend first — then you can share with them.</p>
          <Link href="/friends" onClick={onClose} className="inline-flex min-h-10 items-center rounded-full bg-primary-strong px-4 text-[13px] font-medium text-on-primary-strong">
            Invite a friend
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setPicked(all ? new Set() : new Set(friends.map((f) => f.id)))}
            className="min-h-8 rounded-full px-2 text-[12.5px] font-medium text-link hover:bg-track"
          >
            {all ? "Clear" : "Select all"}
          </button>
          <ul className="max-h-[45dvh] divide-y divide-border overflow-y-auto rounded-[14px] border border-border">
            {friends.map((f) => {
              const on = picked.has(f.id);
              return (
                <li key={f.id}>
                  <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(f.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-track">
                    <Avatar person={f} size={34} />
                    <PersonLabel person={f} />
                    <StreakBadge streak={f.streak} />
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-primary-strong bg-primary-strong text-on-primary-strong" : "border-border"}`} aria-hidden>
                      {on ? <Check className="h-3 w-3" /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {error ? (
            <p role="alert" className="text-[12.5px] text-ink">
              {error}
            </p>
          ) : null}
          <Button className="w-full" disabled={!picked.size || sending} onClick={() => void send()}>
            {sending ? "Sending…" : picked.size ? `Send to ${picked.size}` : "Pick who gets it"}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
