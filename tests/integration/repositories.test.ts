import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Deps } from "@/core/application/context";
import {
  createMeeting,
  issueRoomSession,
  joinMeeting,
  loginUser,
  performHostAction,
  refreshSession,
  registerUser,
  saveWhiteboard,
} from "@/core/application/use-cases";
import type { DomainError } from "@/core/domain/errors";
import { argon2Hasher } from "@/infrastructure/auth/passwordHasher";
import { createPrismaClient, type Db } from "@/infrastructure/database/prisma";
import { createRepositories } from "@/infrastructure/database/repositories";
import { createTestDeps } from "../helpers/inMemory";

/**
 * Runs use cases against real Postgres repositories in an isolated `test` schema.
 * Set TEST_DATABASE_URL (…?schema=test) to enable; skipped otherwise.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: DomainError) => e.code,
  );

suite("Prisma repositories (integration)", { timeout: 30_000 }, () => {
  let db: Db;
  let deps: Deps;

  beforeAll(() => {
    db = createPrismaClient(url!, "test");
    deps = {
      ...createTestDeps(new Date()).deps,
      ...createRepositories(db, "test"),
      hasher: argon2Hasher,
      clock: { now: () => new Date() },
    };
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      `TRUNCATE test.whiteboards, test.shared_files, test.chat_messages, test.participants, test.meetings,
                test.refresh_tokens, test.rate_limit_buckets, test.users CASCADE`,
    );
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("registers with Argon2id and logs in", async () => {
    const s = await registerUser(
      deps,
      { email: "int@x.io", password: "integration-1", displayName: "Int" },
      { ip: "1.1.1.1" },
    );
    const row = await db.user.findUniqueOrThrow({ where: { id: s.user.id } });
    expect(row.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(await code(loginUser(deps, { email: "int@x.io", password: "integration-1" }, { ip: "1.1.1.1" }))).toBe("ok");
    expect(await code(loginUser(deps, { email: "int@x.io", password: "wrong" }, { ip: "1.1.1.1" }))).toBe(
      "INVALID_CREDENTIALS",
    );
    const after = await db.user.findUniqueOrThrow({ where: { id: s.user.id } });
    expect(after.failedLoginCount).toBe(1);
  });

  it("rate-limit buckets increment atomically under concurrency", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => deps.rateLimits.hit("concurrent", 60_000)));
    expect(results.map((r) => r.count).sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it("rotates refresh tokens and revokes the family on reuse", async () => {
    const s = await registerUser(
      deps,
      { email: "rot@x.io", password: "integration-1", displayName: "Rot" },
      { ip: "1.1.1.2" },
    );
    const next = await refreshSession(deps, s.refreshToken);
    await db.refreshToken.updateMany({
      where: { replacedBy: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });
    expect(await code(refreshSession(deps, s.refreshToken))).toBe("UNAUTHENTICATED");
    expect(await code(refreshSession(deps, next.refreshToken))).toBe("UNAUTHENTICATED");
  });

  it("runs a meeting lifecycle with waiting room and whiteboard persistence", async () => {
    const h = await registerUser(
      deps,
      { email: "h@x.io", password: "integration-1", displayName: "Host" },
      { ip: "1.1.1.3" },
    );
    const g = await registerUser(
      deps,
      { email: "g@x.io", password: "integration-1", displayName: "Guest" },
      { ip: "1.1.1.4" },
    );
    const host = { kind: "user" as const, userId: h.user.id, name: "Host" };
    const member = { kind: "user" as const, userId: g.user.id, name: "Guest" };
    const m = await createMeeting(deps, host.userId, { title: "Integration" });

    await joinMeeting(deps, m.code, host, {}, { ip: "1.1.1.3" });
    const { participant } = await joinMeeting(deps, m.code, member, {}, { ip: "1.1.1.4" });
    expect(participant.status).toBe("WAITING");
    await performHostAction(deps, m.code, host, { action: "admit", participantId: participant.id });

    const session = await issueRoomSession(deps, m.code, member);
    expect(session.participant.status).toBe("ADMITTED");
    expect(await deps.participants.countActive(session.meeting.id, new Date(Date.now() - 60_000))).toBe(1);

    const element = {
      id: "e1",
      authorId: participant.id,
      color: "#112233",
      size: 4,
      clock: 1,
      type: "rect",
      x: 0,
      y: 0,
      width: 5,
      height: 5,
    };
    expect((await saveWhiteboard(deps, m.code, member, { elements: [element] })).version).toBe(1);
    expect((await saveWhiteboard(deps, m.code, member, { elements: [element] })).version).toBe(2);
    const board = await deps.whiteboards.find(session.meeting.id);
    expect(board?.elements).toHaveLength(1);
  });
});
