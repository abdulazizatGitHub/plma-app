"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/kit";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar } from "@/components/social/avatar";
import { API_BASE } from "@/lib/v2/api";
import { PENDING_INVITE } from "@/lib/v2/use-social";

type Inviter = { name: string; username: string | null; avatarColor: string | null };

/**
 * An invite link (SOC-01/02). Signed out: show who invited you and sign up —
 * the code waits on this device and is claimed once you're in. Signed in: one
 * tap to become friends.
 */
function Invite() {
  const params = useSearchParams();
  const code = (params.get("code") ?? "").slice(0, 40);
  const router = useRouter();
  const { status, getAccessToken } = useAuth();
  const [inviter, setInviter] = useState<Inviter | null | "missing">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return setInviter("missing"); // eslint-disable-line react-hooks/set-state-in-effect -- no code in the link
    void fetch(`${API_BASE}/v1/public/invite/${encodeURIComponent(code)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as { inviter: Inviter }).inviter : "missing"))
      .catch(() => "missing" as const)
      .then(setInviter);
  }, [code]);

  const remember = () => {
    try {
      localStorage.setItem(PENDING_INVITE, code);
    } catch {
      /* storage blocked: they can open the link again after signing up */
    }
  };

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const r = await fetch(`${API_BASE}/v1/invite/${encodeURIComponent(code)}/accept`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: "{}" });
      const body = (await r.json().catch(() => null)) as { status?: string; error?: { message?: string } } | null;
      if (!r.ok) throw new Error(body?.error?.message ?? "Couldn't accept the invite.");
      router.replace("/friends");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col justify-center px-4 py-8">
      <div className="card space-y-4 p-6 text-center">
        {inviter === null ? (
          <div className="skeleton mx-auto h-24 w-full" aria-busy="true" aria-label="Loading invite" />
        ) : inviter === "missing" ? (
          <>
            <h1 className="text-[20px] font-semibold text-ink">This invite link isn&apos;t valid</h1>
            <p className="text-[13.5px] text-ink-2">It may have been replaced by a new one. Ask your friend to send it again.</p>
            <Link href="/" className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary-strong px-5 text-[13px] font-medium text-on-primary-strong">
              Open Life
            </Link>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <Avatar person={{ name: inviter.name, username: inviter.username, avatarColor: inviter.avatarColor as never }} size={64} />
            </div>
            <div>
              <h1 className="text-[20px] font-semibold text-ink">{inviter.name} invited you</h1>
              {inviter.username ? <p className="text-[13px] text-ink-2">@{inviter.username}</p> : null}
            </div>
            <p className="text-[13.5px] text-ink-2">Life keeps your prayers, habits and plans in one place. Friends cheer each other on — they see points and streaks, never your items.</p>
            {status === "signed_in" ? (
              <Button className="w-full" disabled={busy} onClick={() => void accept()}>
                {busy ? "Adding…" : `Add ${inviter.name} as a friend`}
              </Button>
            ) : status === "signed_out" ? (
              <div className="space-y-2">
                <Link href="/sign-up" onClick={remember} className="flex min-h-11 items-center justify-center rounded-full bg-primary-strong px-5 text-[14px] font-medium text-on-primary-strong">
                  Sign up to join {inviter.name}
                </Link>
                <Link href="/sign-in" onClick={remember} className="flex min-h-10 items-center justify-center text-[13px] font-medium text-link">
                  I already have an account
                </Link>
              </div>
            ) : (
              <div className="skeleton h-11" aria-busy="true" />
            )}
            {error ? (
              <p role="alert" className="text-[12.5px] text-ink">
                {error}
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <Invite />
    </Suspense>
  );
}
