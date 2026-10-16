"use client";

import { shareText, type PublicPerson, type SharePayload } from "@life/shared";
import { HandHeart, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/kit";
import { useApi } from "@/lib/v2/api";
import { Avatar } from "./avatar";
import { ShareVisual, shareDetail } from "./share-card";

/**
 * A snap opened full-screen, once (owner, 2026-10-16). Closing it leaves only
 * "Opened" in the list. Kudos and "Snap back" (today's rings) are one tap.
 */
export function SnapViewer({
  snapId,
  from,
  kudosSent,
  onClose,
  onKudos,
  onSnapBack,
}: {
  snapId: string;
  from: PublicPerson;
  kudosSent: boolean;
  onClose: (opened: boolean) => void;
  onKudos: () => void;
  onSnapBack: () => Promise<boolean>;
}) {
  const api = useApi();
  const [payload, setPayload] = useState<SharePayload | null | "gone">(null);
  const [kudos, setKudos] = useState(kudosSent);
  const [snapped, setSnapped] = useState(false);
  const opened = useRef(false);

  useEffect(() => {
    void api<{ opened: boolean; payload: SharePayload | null }>(`/v1/snaps/${snapId}/open`, { body: {} }).then((r) => {
      opened.current = r.ok;
      setPayload(r.ok && r.data.payload ? r.data.payload : "gone");
    });
  }, [api, snapId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(opened.current);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Snap from ${from.name}`} className="fixed inset-0 z-[70] flex flex-col bg-ink/90 text-bg backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <Avatar person={from} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{from.name}</p>
          {from.username ? <p className="truncate text-[12px] opacity-75">@{from.username}</p> : null}
        </div>
        <button type="button" aria-label="Close" onClick={() => onClose(opened.current)} className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <button type="button" aria-label="Close snap" onClick={() => onClose(opened.current)} className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        {payload === null ? (
          <span className="h-24 w-24 animate-pulse rounded-full bg-white/15 motion-reduce:animate-none" aria-label="Opening" />
        ) : payload === "gone" ? (
          <p className="text-[15px] opacity-80">This snap was already opened.</p>
        ) : (
          <>
            <span className="badge-pop rounded-full bg-surface p-4">
              <ShareVisual payload={payload} size={120} />
            </span>
            <p className="max-w-xs text-[20px] leading-snug font-semibold">{shareText(from.name, payload)}</p>
            {shareDetail(payload) ? <p className="text-[14px] opacity-80">{shareDetail(payload)}</p> : null}
            <p className="text-[12px] opacity-60">Tap anywhere to close · opens once</p>
          </>
        )}
      </button>
      <div className="flex gap-2 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={kudos || payload === null}
          onClick={() => {
            setKudos(true);
            onKudos();
          }}
        >
          <HandHeart className="h-4 w-4" aria-hidden /> {kudos ? "Kudos sent" : "Kudos"}
        </Button>
        <Button
          className="flex-1"
          disabled={snapped}
          onClick={() => void onSnapBack().then((ok) => ok && setSnapped(true))}
        >
          <Send className="h-4 w-4" aria-hidden /> {snapped ? "Snapped back" : "Snap back"}
        </Button>
      </div>
    </div>
  );
}
