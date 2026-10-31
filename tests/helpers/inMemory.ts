import type { Deps } from "@/core/application/context";
import type { IceServer, SystemEvent } from "@/core/application/ports";
import type { BoardElement, ChatMessage, Meeting, Participant, SharedFile, User } from "@/core/domain/entities";
import type { RefreshTokenRecord } from "@/core/domain/repositories";
import { createTokenService } from "@/infrastructure/auth/tokenService";
import { createRoomTokenIssuer } from "@/infrastructure/realtime/roomTokens";

/** Fast fake hasher: tests exercise logic, not Argon2 itself. */
const fakeHasher = {
  hash: async (p: string) => `hashed:${p}`,
  verify: async (h: string, p: string) => h === `hashed:${p}`,
};

export function createTestDeps(now = new Date("2026-10-20T10:00:00Z")) {
  const clock = { current: now, now: () => clock.current };
  const users = new Map<string, User>();
  const tokens = new Map<string, RefreshTokenRecord>();
  const buckets = new Map<string, { count: number; resetAt: Date }>();
  const meetings = new Map<string, Meeting>();
  const participants = new Map<string, Participant>();
  const messages = new Map<string, ChatMessage>();
  const files = new Map<string, SharedFile>();
  const boards = new Map<string, { elements: BoardElement[]; version: number; updatedAt: Date }>();
  const published: { topic: string; event: SystemEvent }[] = [];
  const id = () => crypto.randomUUID();

  const deps: Deps = {
    clock,
    hasher: fakeHasher,
    tokens: createTokenService({ accessSecret: "a".repeat(40), refreshSecret: "r".repeat(40) }),
    roomTokens: createRoomTokenIssuer({ topicSecret: "t".repeat(32), jwtSecret: "j".repeat(40) }),
    broadcaster: { publish: async (topic, event) => void published.push({ topic, event }) },
    storage: {
      createUploadUrl: async (path) => ({ url: `https://storage.test/${path}?token=x`, token: "x" }),
      createDownloadUrl: async (path) => `https://storage.test/${path}?signed=1`,
      exists: async (path) => {
        const f = [...files.values()].find((x) => x.storagePath === path);
        return f ? { exists: true, size: f.sizeBytes } : { exists: false };
      },
      remove: async () => undefined,
    },
    turn: { getIceServers: async (): Promise<IceServer[]> => [{ urls: "stun:stun.test:3478" }] },
    users: {
      findById: async (i) => users.get(i) ?? null,
      findByEmail: async (e) => [...users.values()].find((u) => u.email === e) ?? null,
      create: async (d) => {
        const u: User = {
          ...d,
          id: id(),
          avatarUrl: null,
          theme: "SYSTEM",
          preferences: {},
          failedLoginCount: 0,
          lockedUntil: null,
          createdAt: clock.now(),
        };
        users.set(u.id, u);
        return u;
      },
      update: async (i, patch) => {
        const u = { ...users.get(i)!, ...patch };
        users.set(i, u);
        return u;
      },
    },
    refreshTokens: {
      create: async (d) => {
        const r: RefreshTokenRecord = { ...d, id: id(), revokedAt: null, replacedBy: null };
        tokens.set(r.id, r);
        return r;
      },
      findByHash: async (h) => [...tokens.values()].find((t) => t.tokenHash === h) ?? null,
      markReplaced: async (i, by) => void tokens.set(i, { ...tokens.get(i)!, replacedBy: by, revokedAt: clock.now() }),
      revokeFamily: async (f) => {
        for (const t of tokens.values())
          if (t.familyId === f && !t.revokedAt) tokens.set(t.id, { ...t, revokedAt: clock.now() });
      },
      revokeAllForUser: async (u) => {
        for (const t of tokens.values())
          if (t.userId === u && !t.revokedAt) tokens.set(t.id, { ...t, revokedAt: clock.now() });
      },
    },
    rateLimits: {
      hit: async (key, windowMs) => {
        const b = buckets.get(key);
        const next =
          !b || b.resetAt <= clock.now()
            ? { count: 1, resetAt: new Date(clock.now().getTime() + windowMs) }
            : { ...b, count: b.count + 1 };
        buckets.set(key, next);
        return next;
      },
      reset: async (key) => void buckets.delete(key),
    },
    meetings: {
      create: async (d) => {
        const m: Meeting = {
          ...d,
          id: id(),
          locked: false,
          topicEpoch: 0,
          startedAt: null,
          endedAt: null,
          createdAt: clock.now(),
        };
        meetings.set(m.id, m);
        return m;
      },
      findByCode: async (c) => [...meetings.values()].find((m) => m.code === c) ?? null,
      findById: async (i) => meetings.get(i) ?? null,
      update: async (i, patch) => {
        const m = { ...meetings.get(i)!, ...patch };
        meetings.set(i, m);
        return m;
      },
      listUpcomingForUser: async (u) => [...meetings.values()].filter((m) => m.hostId === u && m.status !== "ENDED"),
      listRecentForUser: async (u) => [...meetings.values()].filter((m) => m.hostId === u && m.startedAt),
      listHistoryForUser: async (u) => [...meetings.values()].filter((m) => m.hostId === u && m.startedAt),
      delete: async (i) => void meetings.delete(i),
    },
    participants: {
      findById: async (i) => participants.get(i) ?? null,
      findByMeetingAndUser: async (m, u) =>
        [...participants.values()].find((p) => p.meetingId === m && p.userId === u) ?? null,
      listByMeeting: async (m, statuses) =>
        [...participants.values()].filter((p) => p.meetingId === m && (!statuses || statuses.includes(p.status))),
      countActive: async (m, since) =>
        [...participants.values()].filter(
          (p) => p.meetingId === m && p.status === "ADMITTED" && p.lastSeenAt && p.lastSeenAt >= since,
        ).length,
      create: async (d) => {
        const p: Participant = {
          ...d,
          id: id(),
          joinedAt: null,
          leftAt: null,
          lastSeenAt: null,
          createdAt: clock.now(),
        };
        participants.set(p.id, p);
        return p;
      },
      update: async (i, patch) => {
        const p = { ...participants.get(i)!, ...patch };
        participants.set(i, p);
        return p;
      },
      markAllLeft: async (m, at) => {
        for (const p of participants.values())
          if (p.meetingId === m) participants.set(p.id, { ...p, leftAt: at, lastSeenAt: null });
      },
    },
    messages: {
      create: async (d) => {
        const m = { ...d, createdAt: clock.now() };
        messages.set(m.id, m);
        return m;
      },
      listByMeeting: async (m) => [...messages.values()].filter((x) => x.meetingId === m),
    },
    files: {
      create: async (d) => {
        const f = { ...d, uploaded: false, createdAt: clock.now() };
        files.set(f.id, f);
        return f;
      },
      findById: async (i) => files.get(i) ?? null,
      markUploaded: async (i) => {
        const f = { ...files.get(i)!, uploaded: true };
        files.set(i, f);
        return f;
      },
      listByMeeting: async (m) => [...files.values()].filter((f) => f.meetingId === m),
      delete: async (i) => void files.delete(i),
    },
    whiteboards: {
      find: async (m) => {
        const b = boards.get(m);
        return b ? { meetingId: m, ...b } : null;
      },
      save: async (m, elements) => {
        const b = { elements, version: (boards.get(m)?.version ?? 0) + 1, updatedAt: clock.now() };
        boards.set(m, b);
        return { meetingId: m, ...b };
      },
    },
  };
  return { deps, clock, store: { users, tokens, meetings, participants, messages, files, published } };
}
