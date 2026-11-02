"use client";

import type { AvatarColor } from "@life/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { useStore } from "@/components/providers/store-provider";
import { ShareSheet, type ShareWhat } from "@/components/social/share-sheet";
import { useApi } from "./api";

export type Me = {
  id: string;
  email: string | null;
  displayName: string | null;
  username: string | null;
  avatarColor: AvatarColor | null;
  visibility: "private" | "friends" | "selected" | "everyone";
};

type SocialState = {
  me: Me | null;
  /** Unread Activity entries (bell dot). */
  unread: number;
  refreshMe: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  setMe: (me: Me) => void;
  /** Opens the snap sheet from anywhere (header, Today card, an item's menu). */
  openSnap: (what: ShareWhat) => void;
};

const SocialContext = createContext<SocialState | null>(null);
const CACHE = "social_me";
/** An invite link opened while signed out waits here until the user is in. */
export const PENDING_INVITE = "life_pending_invite";
/** The same for a group link (Phase 9b). */
export const PENDING_GROUP_INVITE = "life_pending_group_invite";

/**
 * Social basics for every screen (Phase 9a): who I am (name, @username,
 * avatar), Activity's unread count, and claiming an invite link opened before
 * signing up. Friends, boards and shares are fetched by their own screens.
 */
export function SocialProvider({ children }: { children: ReactNode }) {
  const { store, lastResult } = useStore();
  const api = useApi();
  const { notify } = useAddSheet();
  const [me, setMeState] = useState<Me | null>(null);
  const [unread, setUnread] = useState(0);
  const claiming = useRef(false);
  const lastFetch = useRef(0);
  const [snap, setSnap] = useState<ShareWhat | null>(null);

  useEffect(() => {
    if (!store) return;
    try {
      const raw = store.getMeta(CACHE);
      if (raw) setMeState(JSON.parse(raw) as Me); // eslint-disable-line react-hooks/set-state-in-effect -- the cached copy, once the store opens
    } catch {
      /* ignore a bad cache */
    }
  }, [store]);

  const setMe = useCallback(
    (m: Me) => {
      setMeState(m);
      store?.setMeta(CACHE, JSON.stringify(m));
    },
    [store],
  );

  const refreshMe = useCallback(async () => {
    const r = await api<Me>("/v1/me");
    if (r.ok && r.data?.id) setMe(r.data);
  }, [api, setMe]);

  const refreshUnread = useCallback(async () => {
    const r = await api<{ unread: number }>("/v1/activity");
    if (r.ok) setUnread(r.data.unread);
  }, [api]);

  // After each successful sync: who I am, unread activity, and any invite waiting to be claimed.
  useEffect(() => {
    if (!lastResult?.ok) return;
    if (lastResult.pushed > 0 || Date.now() - lastFetch.current > 2 * 60_000) {
      lastFetch.current = Date.now();
      void refreshMe();
      void refreshUnread();
    }
    let code: string | null = null;
    let groupCode: string | null = null;
    try {
      code = localStorage.getItem(PENDING_INVITE);
      groupCode = localStorage.getItem(PENDING_GROUP_INVITE);
    } catch {
      /* storage blocked */
    }
    if (groupCode && !claiming.current) {
      claiming.current = true;
      void api<{ groupId: string; name: string }>(`/v1/group-invite/${encodeURIComponent(groupCode)}/accept`, { body: {} }).then((r) => {
        claiming.current = false;
        if (r.ok || r.status === 404) {
          try {
            localStorage.removeItem(PENDING_GROUP_INVITE);
          } catch {
            /* fine */
          }
        }
        if (r.ok) notify({ message: `You joined ${r.data.name}` });
        else if (r.status === 404) notify({ message: "That group link isn't valid any more." });
      });
      return;
    }
    if (!code || claiming.current) return;
    claiming.current = true;
    void api<{ status: string; friend: { name: string } | null }>(`/v1/invite/${encodeURIComponent(code)}/accept`, { body: {} }).then((r) => {
      claiming.current = false;
      if (r.ok || r.status === 404) {
        try {
          localStorage.removeItem(PENDING_INVITE);
        } catch {
          /* fine */
        }
      }
      if (r.ok && r.data.status === "friends" && r.data.friend) notify({ message: `You and ${r.data.friend.name} are now friends` });
      else if (!r.ok && r.status === 404) notify({ message: "That invite link isn't valid any more." });
    });
  }, [lastResult, refreshMe, refreshUnread, api, notify]);

  const value = useMemo(() => ({ me, unread, refreshMe, refreshUnread, setMe, openSnap: setSnap }), [me, unread, refreshMe, refreshUnread, setMe]);
  return (
    <SocialContext.Provider value={value}>
      {children}
      <ShareSheet what={snap} onClose={() => setSnap(null)} />
    </SocialContext.Provider>
  );
}

const NONE: SocialState = { me: null, unread: 0, refreshMe: async () => {}, refreshUnread: async () => {}, setMe: () => {}, openSnap: () => {} };

export function useSocial(): SocialState {
  return useContext(SocialContext) ?? NONE;
}
