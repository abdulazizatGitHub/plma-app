"use client";

import { useRouter } from "next/navigation";
import { useEffect, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";

type AuthShellProps = {
  title: string;
  subtitle?: ReactNode;
  /** Wraps children in a form when given; otherwise children render their own form. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Send already-signed-in users home (sign-in / sign-up pages). */
  redirectIfSignedIn?: boolean;
};

/** Centred card for the auth screens, built from the v2 kit tokens. */
export function AuthShell({ title, subtitle, onSubmit, children, footer, redirectIfSignedIn = false }: AuthShellProps) {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (redirectIfSignedIn && status === "signed_in") router.replace("/");
  }, [redirectIfSignedIn, status, router]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col justify-center px-4 py-6 sm:py-10">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[14px] font-semibold text-on-fill" aria-hidden>
          L
        </span>
        <span className="text-[15px] font-semibold text-ink">Life</span>
      </div>
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      {subtitle ? <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p> : null}
      {onSubmit ? (
        <form noValidate onSubmit={onSubmit} className="card mt-4 space-y-3 p-4">
          {children}
        </form>
      ) : (
        <div className="card mt-4 space-y-3 p-4">{children}</div>
      )}
      {footer ? <div className="mt-4 space-y-1.5 text-center text-[13px] text-ink-2">{footer}</div> : null}
    </main>
  );
}

/** Inline error or notice inside an auth form. */
export function FormMessage({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className="flex items-start gap-2 rounded-(--radius-control) bg-track px-3 py-2 text-[13px] text-ink">
      <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone === "error" ? "bg-todo" : "bg-done"}`} />
      <span>{children}</span>
    </p>
  );
}

/** Shown under a disabled submit button so it's clear why it can't be pressed. */
export function DisabledHint({ show, message = "Fill in all required fields (*) to continue." }: { show: boolean; message?: ReactNode }) {
  return show ? <p className="text-center text-[12px] text-ink-2">{message}</p> : null;
}
