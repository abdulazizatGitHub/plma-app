import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Browser Supabase client (auth only — app data goes through our API). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set (see docs/guides/AUTH_SETUP.md)");
    }
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

/** Sign-in uses this to switch to the "enter your code" step. */
export const EMAIL_NOT_CONFIRMED = "Confirm your email first. Enter the 6-digit code we emailed you.";

/** Turns Supabase auth errors into short, plain messages. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed")) return EMAIL_NOT_CONFIRMED;
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Sign in instead.";
  if (m.includes("password should be") || m.includes("weak password")) return "Use a stronger password: 8+ characters with upper and lower case, a number and a symbol.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Too many attempts. Wait a minute and try again.";
  if (m.includes("token has expired") || m.includes("otp_expired") || m.includes("expired")) return "That code has expired. Send a new one.";
  if (m.includes("invalid") && (m.includes("token") || m.includes("otp"))) return "That code isn't right. Check the email and try again.";
  if (m.includes("same password") || m.includes("different from the old")) return "Choose a password you haven't used before.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Can't reach the server. Check your connection.";
  return message;
}
