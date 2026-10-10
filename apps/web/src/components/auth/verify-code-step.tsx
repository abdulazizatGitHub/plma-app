"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, OtpInput } from "@/components/kit";
import { otpCode } from "@/lib/forms/validators";
import { FormMessage } from "./auth-shell";

const RESEND_SECONDS = 60;

type VerifyCodeStepProps = {
  email: string;
  /** Verifies the code; returns an error message or null. */
  onVerify: (code: string) => Promise<string | null>;
  /** Sends (another) code; returns an error message or null. */
  onResend: () => Promise<string | null>;
  onChangeEmail: () => void;
  /** Start the resend cooldown immediately (a code was just sent). */
  justSent?: boolean;
  submitLabel?: string;
};

/** "Enter the 6-digit code we emailed you" — Verify enabled only at 6 digits; resend with cooldown. */
export function VerifyCodeStep({ email, onVerify, onResend, onChangeEmail, justSent = true, submitLabel = "Verify" }: VerifyCodeStepProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(justSent ? RESEND_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const valid = otpCode(code) === null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const message = await onVerify(code);
    setBusy(false);
    if (message) setError(message);
  }

  async function resend() {
    setInfo(null);
    setError(null);
    const message = await onResend();
    if (message) setError(message);
    else {
      setInfo(`A new code is on its way to ${email}.`);
      setCooldown(RESEND_SECONDS);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <p className="text-[14px] text-ink-2">
        We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>. It expires in 15 minutes. Check your spam folder if
        you don&apos;t see it.
      </p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {info ? <FormMessage tone="info">{info}</FormMessage> : null}
      <OtpInput value={code} onChange={setCode} autoFocus />
      <Button type="submit" size="lg" className="w-full" disabled={!valid || busy}>
        {busy ? "Checking…" : submitLabel}
      </Button>
      <div className="flex items-center justify-between text-[14px]">
        <button type="button" onClick={onChangeEmail} className="min-h-11 font-medium text-link">
          Change email
        </button>
        <button type="button" onClick={() => void resend()} disabled={cooldown > 0} className="min-h-11 font-medium text-link disabled:text-ink-2">
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
