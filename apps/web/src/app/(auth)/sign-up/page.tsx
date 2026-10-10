"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell, DisabledHint, FormMessage } from "@/components/auth/auth-shell";
import { VerifyCodeStep } from "@/components/auth/verify-code-step";
import { Button, Checkbox, PasswordField, TextField } from "@/components/kit";
import { useAuth } from "@/components/providers/auth-provider";
import { useForm } from "@/lib/forms/use-form";
import { confirmPassword, email, fullName, newPassword } from "@/lib/forms/validators";

export default function SignUpPage() {
  const { signUp, verifyEmailCode, resendSignupCode } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"form" | "code">("form");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useForm(
    { name: "", email: "", password: "", confirm: "", terms: false as boolean },
    {
      name: (v) => fullName(v),
      email: (v) => email(v),
      password: (v) => newPassword(v),
      confirm: (v, all) => confirmPassword(all.password)(v),
      terms: (v) => (v ? null : "Please accept the Terms and Privacy Policy."),
    },
  );
  const { values } = form;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.attempt() || busy) return;
    setBusy(true);
    setError(null);
    const result = await signUp(values.name, values.email, values.password);
    setBusy(false);
    if (result.error) setError(result.error);
    else if (result.needsCode) setStep("code");
    else router.replace("/");
  }

  if (step === "code") {
    return (
      <AuthShell title="Check your email" subtitle="Enter the code to confirm your account.">
        <VerifyCodeStep
          email={values.email.trim()}
          onVerify={async (code) => {
            const message = await verifyEmailCode(values.email, code);
            if (!message) router.replace("/");
            return message;
          }}
          onResend={() => resendSignupCode(values.email)}
          onChangeEmail={() => setStep("form")}
          submitLabel="Confirm account"
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Plan your day and keep your streaks. Your data stays private."
      onSubmit={onSubmit}
      redirectIfSignedIn
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-link">
            Sign in
          </Link>
        </p>
      }
    >
      <p className="text-[12px] text-ink-2">All fields are required. We&apos;ll email you a 6-digit code.</p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <TextField label="Full name" autoComplete="name" placeholder="e.g. Abdul Aziz" required {...form.field("name")} />
      <TextField label="Email" type="email" autoComplete="email" inputMode="email" placeholder="name@example.com" required {...form.field("email")} />
      <PasswordField label="Password" autoComplete="new-password" required showRules {...form.field("password")} />
      <PasswordField label="Confirm password" autoComplete="new-password" required {...form.field("confirm")} />
      <Checkbox
        checked={values.terms}
        onChange={(v) => {
          form.set("terms", v);
          form.touch("terms");
        }}
        error={form.shownError("terms")}
        required
      >
        I agree to the{" "}
        <Link href="/legal/terms" className="font-medium text-link" target="_blank">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="font-medium text-link" target="_blank">
          Privacy Policy
        </Link>
        . *
      </Checkbox>
      <Button type="submit" size="lg" className="w-full" disabled={!form.isValid || busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
      <DisabledHint show={!form.isValid} />
    </AuthShell>
  );
}
