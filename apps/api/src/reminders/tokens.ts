import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Signed action tokens for the Done / Snooze buttons on a notification
 * (REM-03). The service worker has no session, so each notification carries
 * a short-lived token naming exactly one fire of one user's item; the API
 * trusts nothing else from the request.
 */

export type ActionClaims = {
  /** User id. */
  u: string;
  /** Queue key of the fire. */
  k: string;
  /** Item, date and slot (null item for nudges). */
  i: string | null;
  d: string;
  s: string;
  /** Snooze length in minutes. */
  z: number;
  /** Expiry, epoch seconds. */
  e: number;
};

const TTL_S = 24 * 60 * 60;

const mac = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function signAction(secret: string, claims: Omit<ActionClaims, "e">, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...claims, e: Math.floor(now / 1000) + TTL_S })).toString("base64url");
  return `${body}.${mac(secret, body)}`;
}

/** The claims, or null if the token is malformed, forged or expired. */
export function verifyAction(secret: string, token: unknown, now = Date.now()): ActionClaims | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(mac(secret, body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ActionClaims;
    if (typeof c.u !== "string" || typeof c.k !== "string" || typeof c.e !== "number") return null;
    return c.e * 1000 > now ? c : null;
  } catch {
    return null;
  }
}
