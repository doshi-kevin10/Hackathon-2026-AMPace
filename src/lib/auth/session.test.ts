import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { createSessionToken, verifySessionToken } from "./session";
import { verifyCredentials } from "./credentials";

// Tests run with no AUTH_SECRET, so session.ts uses this dev fallback.
const DEV_SECRET = new TextEncoder().encode("ampace-dev-insecure-secret-change-me");

describe("dev credentials", () => {
  it("accepts a seeded user with the correct password", () => {
    const user = verifyCredentials("analyst@ampace.dev", "ampace");
    expect(user).toMatchObject({ email: "analyst@ampace.dev", role: "ANALYST" });
  });

  it("is case-insensitive on email and trims it", () => {
    expect(verifyCredentials("  ANALYST@AMPace.dev ", "ampace")).not.toBeNull();
  });

  it("rejects wrong password and unknown user", () => {
    expect(verifyCredentials("analyst@ampace.dev", "nope")).toBeNull();
    expect(verifyCredentials("ghost@ampace.dev", "ampace")).toBeNull();
  });
});

describe("session tokens", () => {
  it("round-trips a signed session", async () => {
    const token = await createSessionToken({ email: "a@b.dev", name: "A", role: "VIEWER" });
    const user = await verifySessionToken(token);
    expect(user).toEqual({ email: "a@b.dev", name: "A", role: "VIEWER" });
  });

  it("rejects a tampered or missing token", async () => {
    const token = await createSessionToken({ email: "a@b.dev", name: "A", role: "VIEWER" });
    expect(await verifySessionToken(token.slice(0, -3) + "xxx")).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("not.a.jwt")).toBeNull();
  });

  it("rejects a validly-signed token carrying an invalid role", async () => {
    // Forge a properly-signed JWT with a bogus role — must still be rejected.
    const forged = await new SignJWT({ role: "ROOT" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("attacker@b.dev")
      .setExpirationTime("1h")
      .sign(DEV_SECRET);
    expect(await verifySessionToken(forged)).toBeNull();
  });
});
