import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";
import { verifyCredentials } from "./credentials";

describe("dev credentials", () => {
  it("accepts a seeded user with the correct password", () => {
    const user = verifyCredentials("analyst@ampulse.dev", "ampulse");
    expect(user).toMatchObject({ email: "analyst@ampulse.dev", role: "ANALYST" });
  });

  it("is case-insensitive on email and trims it", () => {
    expect(verifyCredentials("  ANALYST@AMPulse.dev ", "ampulse")).not.toBeNull();
  });

  it("rejects wrong password and unknown user", () => {
    expect(verifyCredentials("analyst@ampulse.dev", "nope")).toBeNull();
    expect(verifyCredentials("ghost@ampulse.dev", "ampulse")).toBeNull();
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
});
