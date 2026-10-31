import { describe, expect, it } from "vitest";
import { changePassword, loginUser, logoutUser, refreshSession, registerUser } from "@/core/application/use-cases";
import { DomainError } from "@/core/domain/errors";
import { createTestDeps } from "../helpers/inMemory";

const meta = { ip: "203.0.113.5" };
const creds = { email: "Ada@Example.com", password: "correct-horse-1", displayName: "Ada" };

const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: DomainError) => e.code,
  );

describe("register & login", () => {
  it("registers, normalizes email, and never returns the hash", async () => {
    const { deps } = createTestDeps();
    const s = await registerUser(deps, creds, meta);
    expect(s.user.email).toBe("ada@example.com");
    expect(JSON.stringify(s.user)).not.toContain("hashed");
    expect(s.accessToken.split(".")).toHaveLength(3);
  });

  it("rejects duplicate accounts", async () => {
    const { deps } = createTestDeps();
    await registerUser(deps, creds, meta);
    expect(await code(registerUser(deps, creds, meta))).toBe("CONFLICT");
  });

  it("logs in with the right password only", async () => {
    const { deps } = createTestDeps();
    await registerUser(deps, creds, meta);
    expect(await code(loginUser(deps, { email: creds.email, password: "nope" }, meta))).toBe("INVALID_CREDENTIALS");
    expect(await code(loginUser(deps, { email: "missing@x.io", password: "nope" }, meta))).toBe("INVALID_CREDENTIALS");
    expect(await code(loginUser(deps, { email: creds.email, password: creds.password }, meta))).toBe("ok");
  });

  it("locks the account after 5 failures and unlocks after 15 minutes", async () => {
    const { deps, clock } = createTestDeps();
    await registerUser(deps, creds, meta);
    for (let i = 0; i < 4; i++) {
      expect(await code(loginUser(deps, { email: creds.email, password: "bad" }, { ip: `10.0.0.${i}` }))).toBe(
        "INVALID_CREDENTIALS",
      );
    }
    expect(await code(loginUser(deps, { email: creds.email, password: "bad" }, meta))).toBe("ACCOUNT_LOCKED");
    expect(await code(loginUser(deps, creds, meta))).toBe("ACCOUNT_LOCKED");
    clock.current = new Date(clock.current.getTime() + 16 * 60_000);
    expect(await code(loginUser(deps, creds, meta))).toBe("ok");
  });

  it("rate-limits login attempts per email", async () => {
    const { deps } = createTestDeps();
    const results: string[] = [];
    for (let i = 0; i < 11; i++)
      results.push(await code(loginUser(deps, { email: "x@y.io", password: "p" }, { ip: `10.1.0.${i}` })));
    expect(results.at(-1)).toBe("RATE_LIMITED");
  });
});

describe("refresh token rotation", () => {
  it("rotates tokens and detects reuse of an old one", async () => {
    const { deps, clock, store } = createTestDeps();
    const first = await registerUser(deps, creds, meta);
    const second = await refreshSession(deps, first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // A replay well after rotation looks like theft: the whole family is revoked.
    clock.current = new Date(clock.current.getTime() + 60_000);
    expect(await code(refreshSession(deps, first.refreshToken))).toBe("UNAUTHENTICATED");
    expect(await code(refreshSession(deps, second.refreshToken))).toBe("UNAUTHENTICATED");
    expect([...store.tokens.values()].every((t) => t.revokedAt)).toBe(true);
  });

  it("tolerates two tabs refreshing at the same moment", async () => {
    const { deps } = createTestDeps();
    const first = await registerUser(deps, creds, meta);
    await refreshSession(deps, first.refreshToken);
    expect(await code(refreshSession(deps, first.refreshToken))).toBe("ok");
  });

  it("logout revokes the session", async () => {
    const { deps } = createTestDeps();
    const s = await registerUser(deps, creds, meta);
    await logoutUser(deps, s.refreshToken);
    expect(await code(refreshSession(deps, s.refreshToken))).toBe("UNAUTHENTICATED");
  });

  it("changing the password signs out other sessions", async () => {
    const { deps } = createTestDeps();
    const s = await registerUser(deps, creds, meta);
    const other = await loginUser(deps, creds, meta);
    const fresh = await changePassword(deps, s.user.id, {
      currentPassword: creds.password,
      newPassword: "brand-new-pass-2",
    });
    expect(await code(refreshSession(deps, other.refreshToken))).toBe("UNAUTHENTICATED");
    expect(await code(refreshSession(deps, fresh.refreshToken))).toBe("ok");
    expect(await code(loginUser(deps, { email: creds.email, password: "brand-new-pass-2" }, meta))).toBe("ok");
  });
});
