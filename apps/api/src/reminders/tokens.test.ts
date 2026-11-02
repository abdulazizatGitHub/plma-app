import { describe, expect, it } from "vitest";
import { signAction, verifyAction } from "./tokens.js";

const SECRET = "test-secret-0123456789";
const claims = { u: "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6", k: "item|2026-10-12||0@2026-10-12T10:00", i: "item", d: "2026-10-12", s: "", z: 10 };

describe("notification action tokens", () => {
  it("round-trips the claims", () => {
    expect(verifyAction(SECRET, signAction(SECRET, claims))).toMatchObject(claims);
  });

  it("rejects forged, tampered, foreign-secret and expired tokens", () => {
    const token = signAction(SECRET, claims);
    const [body, sig] = token.split(".");
    const other = Buffer.from(JSON.stringify({ ...claims, u: "someone-else", e: 9e9 })).toString("base64url");
    expect(verifyAction(SECRET, `${other}.${sig}`)).toBeNull();
    expect(verifyAction(SECRET, `${body}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(verifyAction("another-secret", token)).toBeNull();
    expect(verifyAction(SECRET, token, Date.now() + 25 * 60 * 60 * 1000)).toBeNull();
    expect(verifyAction(SECRET, "garbage")).toBeNull();
    expect(verifyAction(SECRET, 42)).toBeNull();
  });
});
