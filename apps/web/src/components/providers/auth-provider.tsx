"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { friendlyAuthError, getSupabase } from "@/lib/auth/supabase";
import { wipeUserStore } from "@/lib/v2/local-store";

export type AuthUser = { id: string; email: string | null; name: string | null };

type AuthState = {
  status: "loading" | "signed_in" | "signed_out";
  user: AuthUser | null;
  /** Each returns an error message, or null on success. */
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Creates the account; Supabase emails a 6-digit code to confirm it. */
  signUp: (name: string, email: string, password: string) => Promise<{ error: string | null; needsCode: boolean }>;
  /** Confirms a sign-up (or unconfirmed sign-in) with the emailed code; signs the user in. */
  verifyEmailCode: (email: string, code: string) => Promise<string | null>;
  resendSignupCode: (email: string) => Promise<string | null>;
  /** Emails a 6-digit password-reset code. */
  sendPasswordReset: (email: string) => Promise<string | null>;
  /** Verifies the reset code, then sets the new password (user ends up signed in). */
  resetWithCode: (email: string, code: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Fresh access token for API calls, or null when signed out. */
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthState | null>(null);

const toUser = (session: Session | null): AuthUser | null => {
  if (!session) return null;
  const meta = session.user.user_metadata as { full_name?: unknown } | undefined;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: typeof meta?.full_name === "string" && meta.full_name.trim() ? meta.full_name.trim() : null,
  };
};

const msg = (error: { message: string } | null) => (error ? friendlyAuthError(error.message) : null);

/**
 * Supabase Auth session (email + password, verified with a 6-digit emailed code).
 * The session is cached in the browser, so a signed-in user can open the app offline.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(toUser(data.session));
      setStatus(data.session ? "signed_in" : "signed_out");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toUser(session));
      setStatus(session ? "signed_in" : "signed_out");
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    return msg(error);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });
    return { error: msg(error), needsCode: !error && !data.session };
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    const { error } = await getSupabase().auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    return msg(error);
  }, []);

  const resendSignupCode = useCallback(async (email: string) => {
    const { error } = await getSupabase().auth.resend({ type: "signup", email: email.trim() });
    return msg(error);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim());
    return msg(error);
  }, []);

  const resetWithCode = useCallback(async (email: string, code: string, password: string) => {
    const supabase = getSupabase();
    const verified = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "recovery" });
    if (verified.error) return msg(verified.error);
    const { error } = await supabase.auth.updateUser({ password });
    return msg(error);
  }, []);

  const signOut = useCallback(async () => {
    // Remove this account's offline data from the device first (ACC-03).
    if (user) await wipeUserStore(user.id).catch(() => undefined);
    // "local" scope works offline too; it clears the cached session.
    await getSupabase().auth.signOut({ scope: "local" });
  }, [user]);

  const getAccessToken = useCallback(async () => {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signUp, verifyEmailCode, resendSignupCode, sendPasswordReset, resetWithCode, signOut, getAccessToken }),
    [status, user, signIn, signUp, verifyEmailCode, resendSignupCode, sendPasswordReset, resetWithCode, signOut, getAccessToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
