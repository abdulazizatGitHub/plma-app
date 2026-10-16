"use client";

import { timeLeft, usernameSchema, type FriendsPayload, type PublicPerson } from "@life/shared";
import { ArrowLeft, Ban, Check, Copy, MoreHorizontal, RefreshCw, Send, Share2, UserMinus, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, ConfirmSheet, PopoverMenu, PopoverMenuItem, TextField } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { Avatar, PersonLabel } from "@/components/social/avatar";
import { UsernameSheet } from "@/components/social/profile-form";
import { ShareSheet, type ShareWhat } from "@/components/social/share-sheet";
import { useApi } from "@/lib/v2/api";
import { ago } from "@/lib/v2/dates";
import { StreakBadge } from "@/components/social/streak-badge";
import { useFriends } from "@/lib/v2/use-friends";
import { useSocial } from "@/lib/v2/use-social";

const fmt = (n: number) => n.toLocaleString("en-US");

/** The line under a friend, chat-style: their last snap, the streak's state, or their points. */
function snapStatus(f: FriendsPayload["friends"][number]): string {
  if (f.streak.atRisk && f.streak.endsAt) return `${timeLeft(f.streak.endsAt, new Date())} — snap to keep your ${f.streak.count}-day streak`;
  if (f.streak.endedAt) return `Your ${f.streak.endedAt}-day streak ended — send a snap to start again`;
  if (f.last) {
    const when = ago(f.last.at);
    if (f.last.direction === "in") return f.last.opened ? `Opened · ${when}` : `New snap · ${when}`;
    return f.last.opened ? `They opened your snap · ${when}` : `Delivered · ${when}`;
  }
  return f.progress ? `${fmt(f.progress.weekPoints)} pts this week · @${f.username ?? ""}` : f.username ? `@${f.username}` : "Say hi with a snap";
}

/** Friends (SOC-01): your invite link, add by @username, requests, friends, blocked. */
export default function FriendsPage() {
  const router = useRouter();
  const api = useApi();
  const { notify } = useAddSheet();
  const { me } = useSocial();
  const { data, loaded, offline, reload } = useFriends();
  const [code, setCode] = useState<string | null>(null);
  const [add, setAdd] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ person: PublicPerson; anchor: HTMLElement } | null>(null);
  const [confirm, setConfirm] = useState<{ person: PublicPerson; action: "remove" | "block" } | null>(null);
  const [share, setShare] = useState<ShareWhat | null>(null);
  const [needName, setNeedName] = useState(false);

  useEffect(() => {
    if (me && !me.username) setNeedName(true); // eslint-disable-line react-hooks/set-state-in-effect -- first-use nudge
  }, [me]);

  const loadLink = useCallback(
    async (rotate = false) => {
      const r = await api<{ code: string }>(rotate ? "/v1/invite/new" : "/v1/invite", rotate ? { body: {} } : {});
      if (r.ok) setCode(r.data.code);
      if (rotate && r.ok) notify({ message: "New link ready — the old one no longer works" });
    },
    [api, notify],
  );
  useEffect(() => {
    void loadLink(); // eslint-disable-line react-hooks/set-state-in-effect -- load the link once
  }, [loadLink]);

  const url = code && typeof window !== "undefined" ? `${window.location.origin}/invite?code=${code}` : null;
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      notify({ message: "Link copied" });
    } catch {
      notify({ message: url });
    }
  };
  const shareLink = async () => {
    if (!url) return;
    const text = `Join me on Life — let's keep each other going.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Life", text, url });
        return;
      } catch {
        return; // cancelled
      }
    }
    void copy();
  };

  const clean = add.trim().replace(/^@/, "").toLowerCase();
  const addValid = usernameSchema.safeParse(clean).success;
  async function sendRequest() {
    if (!addValid || adding) return;
    setAdding(true);
    setAddError(null);
    const r = await api<{ status: string }>("/v1/friends/request", { body: { username: clean } });
    setAdding(false);
    if (!r.ok) return setAddError(r.message);
    setAdd("");
    notify({ message: r.data.status === "friends" ? `You and @${clean} are now friends` : `Request sent to @${clean}` });
    void reload();
  }

  const act = async (person: PublicPerson, action: "accept" | "decline" | "remove" | "block" | "unblock") => {
    const r = await api(`/v1/friends/${person.id}/${action}`, { body: {} });
    if (!r.ok) return notify({ message: r.message });
    const done = { accept: `You and ${person.name} are now friends`, decline: "Request declined", remove: `Removed ${person.name}`, block: `Blocked ${person.name}`, unblock: `Unblocked ${person.name}` };
    notify({ message: done[action] });
    void reload();
  };

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
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-ink">Friends</h1>
          <Link href="/groups" className="inline-flex min-h-9 items-center gap-1 rounded-full bg-track px-3 text-[13px] font-medium text-ink hover:bg-border">
            <Users className="h-4 w-4" aria-hidden /> Groups
          </Link>
        </div>
        <p className="text-[13px] text-ink-2">Keep each other going. Friends see your points and streak — never your items — unless you choose otherwise in Profile.</p>
      </header>
      {offline ? <p className="card px-3 py-2.5 text-[13px] text-ink-2">You&apos;re offline — showing the last copy. Changes need a connection.</p> : null}

      <section aria-label="Invite link" className="card space-y-2.5 p-4">
        <h2 className="text-[15px] font-medium text-ink">Invite with a link</h2>
        <p className="text-[12.5px] text-ink-2">Anyone who opens it can sign up and becomes your friend straight away.</p>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void shareLink()} disabled={!url}>
            <Share2 className="mr-1.5 h-4 w-4" aria-hidden /> Share link
          </Button>
          <Button variant="secondary" onClick={() => void copy()} disabled={!url} aria-label="Copy invite link">
            <Copy className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="secondary" onClick={() => void loadLink(true)} disabled={!url} aria-label="Make a new link">
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </section>

      <section aria-label="Add by username" className="card p-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendRequest();
          }}
        >
          <TextField
            className="flex-1"
            label="Add by @username"
            value={add}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="username"
            onChange={(e) => {
              setAdd(e.target.value);
              setAddError(null);
            }}
            error={addError}
          />
          <Button type="submit" disabled={!addValid || adding} aria-label="Send friend request">
            <UserPlus className="h-4 w-4" aria-hidden />
          </Button>
        </form>
      </section>

      {data.incoming.length ? (
        <section aria-label="Requests" className="card p-2">
          <h2 className="px-2 pt-1 pb-1.5 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">Requests</h2>
          <ul className="divide-y divide-border">
            {data.incoming.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-2 py-2">
                <Avatar person={p} />
                <PersonLabel person={p} />
                <Button size="sm" onClick={() => void act(p, "accept")}>
                  <Check className="mr-1 h-3.5 w-3.5" aria-hidden /> Accept
                </Button>
                <button type="button" aria-label={`Decline ${p.name}`} onClick={() => void act(p, "decline")} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Your friends" className="card p-2">
        <h2 className="px-2 pt-1 pb-1.5 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">
          Friends{data.friends.length ? ` · ${data.friends.length}` : ""}
        </h2>
        {!loaded ? (
          <div className="skeleton m-2 h-16" aria-busy="true" />
        ) : data.friends.length === 0 ? (
          <p className="px-2 pb-2 text-[13px] text-ink-2">No friends yet — share your link to invite someone.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.friends.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-2 py-2">
                <Avatar person={f} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-medium text-ink">{f.name}</span>
                    <StreakBadge streak={f.streak} />
                  </span>
                  <span className="block truncate text-[12px] text-ink-2">{snapStatus(f)}</span>
                </span>
                <Button
                  size="sm"
                  variant={f.last?.direction === "in" && !f.streak.today.me ? "primary" : "secondary"}
                  onClick={() => setShare({ kind: "day", label: "today's rings", to: [f.id] })}
                  aria-label={`Snap ${f.name}`}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden /> {f.last?.direction === "in" && !f.streak.today.me ? "Snap back" : "Snap"}
                </Button>
                <button
                  type="button"
                  aria-label={`More for ${f.name}`}
                  onClick={(e) => setMenu({ person: f, anchor: e.currentTarget })}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {data.outgoing.length ? <p className="px-2 pt-2 pb-1 text-[12px] text-ink-2">Waiting for: {data.outgoing.map((p) => (p.username ? `@${p.username}` : p.name)).join(", ")}</p> : null}
      </section>

      {data.blocked.length ? (
        <section aria-label="Blocked" className="card p-2">
          <h2 className="px-2 pt-1 pb-1.5 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">Blocked</h2>
          <ul className="divide-y divide-border">
            {data.blocked.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-2 py-2">
                <Avatar person={p} size={30} />
                <PersonLabel person={p} />
                <Button size="sm" variant="secondary" onClick={() => void act(p, "unblock")}>
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {menu ? (
        <PopoverMenu anchor={menu.anchor} onClose={() => setMenu(null)} label={menu.person.name}>
          <PopoverMenuItem
            icon={<Send />}
            label="Snap my streak"
            onClick={() => {
              setShare({ kind: "streak", label: "your streak", to: [menu.person.id] });
              setMenu(null);
            }}
          />
          <PopoverMenuItem
            icon={<UserMinus />}
            label="Remove friend"
            onClick={() => {
              setConfirm({ person: menu.person, action: "remove" });
              setMenu(null);
            }}
          />
          <PopoverMenuItem
            icon={<Ban />}
            label="Block"
            onClick={() => {
              setConfirm({ person: menu.person, action: "block" });
              setMenu(null);
            }}
          />
        </PopoverMenu>
      ) : null}
      {confirm ? (
        <ConfirmSheet
          open
          title={confirm.action === "block" ? `Block ${confirm.person.name}?` : `Remove ${confirm.person.name}?`}
          body={
            confirm.action === "block"
              ? "They won't be able to find you, send requests or see anything of yours. They aren't told."
              : "You'll stop seeing each other's progress. You can add each other again later."
          }
          confirmLabel={confirm.action === "block" ? "Block" : "Remove"}
          onConfirm={() => {
            void act(confirm.person, confirm.action);
            setConfirm(null);
          }}
          onClose={() => setConfirm(null)}
        />
      ) : null}
      <ShareSheet what={share} onClose={() => setShare(null)} />
      <UsernameSheet open={needName} onClose={() => setNeedName(false)} />
    </div>
  );
}
