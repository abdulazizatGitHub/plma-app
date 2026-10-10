import type { FastifyReply, FastifyRequest } from "fastify";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it, vi } from "vitest";
import { createTokenVerifier, requireAuth } from "./auth.js";

const SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";
const SECRET = "test-secret-that-is-long-enough-for-hs256-signing";
const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";

async function hsToken(claims: Record<string, unknown> = {}, secret = SECRET) {
  return new SignJWT({ email: "me@example.com", role: "authenticated", ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER)
    .setAudience("authenticated")
    .setIssuer(`${SUPABASE_URL}/auth/v1`)
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

function makeReply() {
  const reply = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(body: unknown) {
      reply.body = body;
      return reply;
    },
  };
  return reply as unknown as FastifyReply & typeof reply;
}

function makeRequest(authorization?: string) {
  return { headers: { authorization }, log: { info: vi.fn() } } as unknown as FastifyRequest;
}

describe("createTokenVerifier", () => {
  const verify = createTokenVerifier({ supabaseUrl: SUPABASE_URL, jwtSecret: SECRET });

  it("accepts a valid HS256 Supabase token and returns the user id and email", async () => {
    await expect(verify(await hsToken())).resolves.toEqual({ id: USER, email: "me@example.com", name: null });
  });

  it("reads the full name from user_metadata", async () => {
    await expect(verify(await hsToken({ user_metadata: { full_name: "  Abdul Aziz " } }))).resolves.toMatchObject({ name: "Abdul Aziz" });
  });

  it("rejects a token signed with another secret", async () => {
    await expect(verify(await hsToken({}, "some-other-secret-that-is-long-enough!!"))).rejects.toThrow();
  });

  it("rejects the wrong audience (e.g. an anon key)", async () => {
    const anon = await new SignJWT({ role: "anon" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(`${SUPABASE_URL}/auth/v1`)
      .setAudience("anon")
      .sign(new TextEncoder().encode(SECRET));
    await expect(verify(anon)).rejects.toThrow();
  });

  it("rejects expired tokens", async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER)
      .setAudience("authenticated")
      .setIssuer(`${SUPABASE_URL}/auth/v1`)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRET));
    await expect(verify(expired)).rejects.toThrow();
  });

  it("verifies asymmetric (ES256) tokens against the project JWKS", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256" };
    const es = createTokenVerifier({ supabaseUrl: SUPABASE_URL, jwks: createLocalJWKSet({ keys: [jwk] }) });
    const token = await new SignJWT({ email: null })
      .setProtectedHeader({ alg: "ES256", kid: "k1" })
      .setSubject(USER)
      .setAudience("authenticated")
      .setIssuer(`${SUPABASE_URL}/auth/v1`)
      .setExpirationTime("1h")
      .sign(privateKey);
    await expect(es(token)).resolves.toEqual({ id: USER, email: null, name: null });
  });
});

describe("requireAuth", () => {
  const verify = createTokenVerifier({ supabaseUrl: SUPABASE_URL, jwtSecret: SECRET });

  it("returns 401 without a bearer token", async () => {
    const reply = makeReply();
    await requireAuth(verify)(makeRequest(), reply);
    expect(reply.statusCode).toBe(401);
  });

  it("returns 401 for a bad token and never calls onUser", async () => {
    const onUser = vi.fn();
    const reply = makeReply();
    await requireAuth(verify, onUser)(makeRequest("Bearer not.a.jwt"), reply);
    expect(reply.statusCode).toBe(401);
    expect(onUser).not.toHaveBeenCalled();
  });

  it("sets request.auth from the token and calls onUser", async () => {
    const onUser = vi.fn().mockResolvedValue(undefined);
    const request = makeRequest(`Bearer ${await hsToken()}`);
    const reply = makeReply();
    await requireAuth(verify, onUser)(request, reply);
    expect(reply.statusCode).toBe(200);
    expect(request.auth).toEqual({ id: USER, email: "me@example.com", name: null });
    expect(onUser).toHaveBeenCalledWith({ id: USER, email: "me@example.com", name: null });
  });
});
