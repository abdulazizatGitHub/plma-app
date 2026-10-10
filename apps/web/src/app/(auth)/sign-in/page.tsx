"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell, DisabledHint, FormMessage } from "@/components/auth/auth-shell";
import { VerifyCodeStep } from "@/components/auth/verify-code-step";
import { Button, PasswordField, TextField } from "@/components/kit";
import { useAuth } from "@/components/providers/auth-provider";
import { EMAIL_NOT_CONFIRMED } from "@/lib/auth/supabase";
import { useForm } from "@/lib/forms/use-form";
import { email, existingPassword } from "@/lib/forms/validators";

export default function SignInPage() {
  const { signIn, verifyEmailCode, resendSignupCode } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"form" | "code">("form");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useForm({ email: "", password: "" }, { email: (v) => email(v), password: (v) => existingPassword(v) });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.attempt() || busy) return;
    setBusy(true);
    setError(null);
    const message = await signIn(form.values.email, form.values.password);
    if (message === EMAIL_NOT_CONFIRMED) {
      // Account exists but was never confirmed: send a fresh code and ask for it.
      await resendSignupCode(form.values.email);
      setBusy(false);
      setStep("code");
      return;
    }
    setBusy(false);
    if (message) setError(message);
    else router.replace("/");
  }

  if (step === "code") {
    return (
      <AuthShell title="Confirm your email" subtitle="Your account isn't confirmed yet. Enter the code we just sent.">
        <VerifyCodeStep
          email={form.values.email.trim()}
          onVerify={async (code) => {
            const verified = await verifyEmailCode(form.values.email, code);
            if (verified) return verified;
            const message = await signIn(form.values.email, form.values.password);
            if (!message) router.replace("/");
            return message;
          }}
          onResend={() => resendSignupCode(form.values.email)}
          onChangeEmail={() => setStep("form")}
          submitLabel="Confirm and sign in"
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with the email and password you registered with."
      onSubmit={onSubmit}
      redirectIfSignedIn
      footer={
        <p>
          New here?{" "}
          <Link href="/sign-up" className="font-medium text-link">
            Create an account
          </Link>
        </p>
      }
    >
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <TextField label="Email" type="email" autoComplete="email" inputMode="email" placeholder="name@example.com" required {...form.field("email")} />
      <div>
        <PasswordField label="Password" autoComplete="current-password" required {...form.field("password")} />
        <div className="mt-1 text-right">
          <Link href="/reset-password" className="inline-flex min-h-11 items-center text-[14px] font-medium text-link">
            Forgot password?
          </Link>
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={!form.isValid || busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <DisabledHint show={!form.isValid} message="Enter your email and password to sign in." />
    </AuthShell>
  );
}
