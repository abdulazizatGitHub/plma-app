"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/kit";
import { useAuth } from "@/components/providers/auth-provider";
import { GroupTile } from "@/components/groups/group-bits";
import { API_BASE } from "@/lib/v2/api";
import { PENDING_GROUP_INVITE } from "@/lib/v2/use-social";
import type { GroupIcon } from "@life/shared";

type Inviter = { name: string; icon: GroupIcon; color: string; memberCount: number };

/**
 * A group link (SOC-02). Signed out: show the group and sign up — the code
 * waits on this device and is claimed once you're in. Signed in: one tap to join.
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
    void fetch(`${API_BASE}/v1/public/group-invite/${encodeURIComponent(code)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as { group: Inviter }).group : "missing"))
      .catch(() => "missing" as const)
      .then(setInviter);
  }, [code]);

  const remember = () => {
    try {
      localStorage.setItem(PENDING_GROUP_INVITE, code);
    } catch {
      /* storage blocked: they can open the link again after signing up */
    }
  };

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const r = await fetch(`${API_BASE}/v1/group-invite/${encodeURIComponent(code)}/accept`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: "{}" });
      const body = (await r.json().catch(() => null)) as { groupId?: string; error?: { message?: string } } | null;
      if (!r.ok) throw new Error(body?.error?.message ?? "Couldn't join the group.");
      router.replace(`/groups/view?id=${body?.groupId ?? ""}`);
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
            <h1 className="text-[20px] font-semibold text-ink">This group link isn&apos;t valid</h1>
            <p className="text-[13.5px] text-ink-2">It may have been replaced by a new one. Ask the group to send it again.</p>
            <Link href="/" className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary-strong px-5 text-[13px] font-medium text-on-primary-strong">
              Open Life
            </Link>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <GroupTile icon={inviter.icon} color={inviter.color} size={64} />
            </div>
            <div>
              <h1 className="text-[20px] font-semibold text-ink">Join {inviter.name}</h1>
              <p className="text-[13px] text-ink-2">
                {inviter.memberCount} member{inviter.memberCount === 1 ? "" : "s"}
              </p>
            </div>
            <p className="text-[13.5px] text-ink-2">Set goals together, check in daily and keep a group streak. Members see your progress on group goals — never your other items.</p>
            {status === "signed_in" ? (
              <Button className="w-full" disabled={busy} onClick={() => void accept()}>
                {busy ? "Joining…" : `Join ${inviter.name}`}
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

export default function GroupInvitePage() {
  return (
    <Suspense fallback={null}>
      <Invite />
    </Suspense>
  );
}
