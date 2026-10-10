import type { FastifyReply, FastifyRequest } from "fastify";
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";

export type AuthUser = { id: string; email: string | null; name: string | null };

declare module "fastify" {
  interface FastifyRequest {
    /** Set by `requireAuth`; identity always comes from the verified token, never the body. */
    auth?: AuthUser;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type VerifierOptions = {
  /** e.g. https://<ref>.supabase.co — used for the issuer check and the JWKS URL. */
  supabaseUrl: string;
  /** Legacy HS256 JWT secret (Supabase → JWT Keys). */
  jwtSecret?: string;
  /** Injected key set for tests; defaults to the project's remote JWKS. */
  jwks?: JWTVerifyGetKey;
};

/**
 * Verifies a Supabase access token. HS256 tokens are checked with the shared
 * secret; ES256/RS256 tokens (asymmetric signing keys) against the project's
 * public JWKS. Requires the `authenticated` audience and a UUID subject.
 */
export function createTokenVerifier({ supabaseUrl, jwtSecret, jwks }: VerifierOptions) {
  const secret = jwtSecret ? new TextEncoder().encode(jwtSecret) : null;
  let remote: JWTVerifyGetKey | null = jwks ?? null;
  const issuer = supabaseUrl ? `${supabaseUrl}/auth/v1` : undefined;

  return async function verify(token: string): Promise<AuthUser> {
    const { alg } = decodeProtectedHeader(token);
    const options = { audience: "authenticated", issuer };
    let payload: JWTPayload;
    if (alg === "HS256") {
      if (!secret) throw new Error("HS256 token but SUPABASE_JWT_SECRET is not set");
      ({ payload } = await jwtVerify(token, secret, { ...options, algorithms: ["HS256"] }));
    } else {
      if (!remote) {
        if (!supabaseUrl) throw new Error("Asymmetric token but SUPABASE_URL is not set");
        remote = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
      }
      ({ payload } = await jwtVerify(token, remote, { ...options, algorithms: ["ES256", "RS256"] }));
    }
    if (typeof payload.sub !== "string" || !UUID_RE.test(payload.sub)) {
      throw new Error("Token subject is not a user id");
    }
    const meta = payload.user_metadata as { full_name?: unknown } | undefined;
    const name = typeof meta?.full_name === "string" && meta.full_name.trim() ? meta.full_name.trim().slice(0, 60) : null;
    return { id: payload.sub, email: typeof payload.email === "string" ? payload.email : null, name };
  };
}

export type TokenVerifier = ReturnType<typeof createTokenVerifier>;

/**
 * Fastify preHandler factory: rejects requests without a valid bearer token and
 * sets `request.auth`. `onUser` runs once per verified request (e.g. to upsert
 * the user's profile row).
 */
export function requireAuth(verify: TokenVerifier, onUser?: (user: AuthUser) => Promise<void>) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) {
      return reply.status(401).send({ error: { code: "unauthorized", message: "Sign in required" } });
    }
    try {
      request.auth = await verify(token);
    } catch (err) {
      request.log.info({ err: (err as Error).message }, "Rejected access token");
      return reply.status(401).send({ error: { code: "unauthorized", message: "Invalid or expired session" } });
    }
    if (onUser) await onUser(request.auth);
  };
}
