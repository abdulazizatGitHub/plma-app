"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell, DisabledHint, FormMessage } from "@/components/auth/auth-shell";
import { Button, OtpInput, PasswordField, TextField } from "@/components/kit";
import { useAuth } from "@/components/providers/auth-provider";
import { useForm } from "@/lib/forms/use-form";
import { confirmPassword, email, newPassword, otpCode } from "@/lib/forms/validators";

/** Forgot password: email → 6-digit code + new password (owner decision: codes, not links). */
export default function ResetPasswordPage() {
  const { sendPasswordReset, resetWithCode } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailForm = useForm({ email: "" }, { email: (v) => email(v) });
  const resetForm = useForm(
    { code: "", password: "", confirm: "" },
    {
      code: (v) => otpCode(v),
      password: (v) => newPassword(v),
      confirm: (v, all) => confirmPassword(all.password)(v),
    },
  );
  const address = emailForm.values.email.trim();

  async function sendCode(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!emailForm.attempt() || busy) return;
    setBusy(true);
    setError(null);
    const message = await sendPasswordReset(address);
    setBusy(false);
    if (message) setError(message);
    else {
      setInfo(null);
      setStep("reset");
    }
  }

  async function reset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resetForm.attempt() || busy) return;
    setBusy(true);
    setError(null);
    const message = await resetWithCode(address, resetForm.values.code, resetForm.values.password);
    setBusy(false);
    if (message) setError(message);
    else router.replace("/");
  }

  const back = (
    <p>
      <Link href="/sign-in" className="font-medium text-link">
        Back to sign in
      </Link>
    </p>
  );

  if (step === "reset") {
    return (
      <AuthShell
        title="Set a new password"
        subtitle={
          <>
            Enter the 6-digit code we sent to <span className="font-medium text-ink">{address}</span>, then choose a new password.
          </>
        }
        onSubmit={reset}
        footer={back}
      >
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        {info ? <FormMessage tone="info">{info}</FormMessage> : null}
        <OtpInput value={resetForm.values.code} onChange={(v) => resetForm.set("code", v)} error={resetForm.shownError("code")} autoFocus />
        <PasswordField label="New password" autoComplete="new-password" required showRules {...resetForm.field("password")} />
        <PasswordField label="Confirm new password" autoComplete="new-password" required {...resetForm.field("confirm")} />
        <Button type="submit" size="lg" className="w-full" disabled={!resetForm.isValid || busy}>
          {busy ? "Saving…" : "Save new password"}
        </Button>
        <DisabledHint show={!resetForm.isValid} message="Enter the code and a valid new password (twice) to continue." />
        <div className="flex justify-between text-[14px]">
          <button type="button" onClick={() => setStep("email")} className="min-h-11 font-medium text-link">
            Change email
          </button>
          <button
            type="button"
            onClick={async () => {
              const message = await sendPasswordReset(address);
              if (message) setError(message);
              else setInfo("A new code is on its way.");
            }}
            className="min-h-11 font-medium text-link"
          >
            Resend code
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email you signed up with. We'll send you a 6-digit code."
      onSubmit={sendCode}
      footer={back}
    >
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <TextField label="Email" type="email" autoComplete="email" inputMode="email" placeholder="name@example.com" required {...emailForm.field("email")} />
      <Button type="submit" size="lg" className="w-full" disabled={!emailForm.isValid || busy}>
        {busy ? "Sending…" : "Send code"}
      </Button>
      <DisabledHint show={!emailForm.isValid} message="Enter a valid email to continue." />
    </AuthShell>
  );
}
