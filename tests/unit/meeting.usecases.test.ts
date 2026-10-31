import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/application/context";
import {
  completeFileUpload,
  createFileUpload,
  createMeeting,
  getTurnCredentials,
  issueRoomSession,
  joinMeeting,
  leaveMeeting,
  performHostAction,
  postChatMessage,
  registerUser,
} from "@/core/application/use-cases";
import type { DomainError } from "@/core/domain/errors";
import { createTestDeps } from "../helpers/inMemory";

const ip = { ip: "198.51.100.1" };
const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: DomainError) => e.code,
  );

async function setup(opts: Record<string, unknown> = {}) {
  const t = createTestDeps();
  const hostSession = await registerUser(
    t.deps,
    { email: "host@x.io", password: "host-password-1", displayName: "Host" },
    ip,
  );
  const host: Actor = { kind: "user", userId: hostSession.user.id, name: "Host" };
  const meeting = await createMeeting(t.deps, host.userId, { title: "Standup", ...opts });
  const users: Actor[] = [];
  for (let i = 0; i < 6; i++) {
    const s = await registerUser(
      t.deps,
      { email: `u${i}@x.io`, password: "user-password-1", displayName: `User ${i}` },
      { ip: `10.9.0.${i}` },
    );
    users.push({ kind: "user", userId: s.user.id, name: `User ${i}` });
  }
  return { ...t, host, meeting, users };
}

describe("joining", () => {
  it("starts the meeting when the host joins and gives them a room token", async () => {
    const { deps, host, meeting } = await setup();
    const { participant } = await joinMeeting(deps, meeting.code, host, {}, ip);
    expect(participant).toMatchObject({ role: "HOST", status: "ADMITTED" });
    const session = await issueRoomSession(deps, meeting.code, host);
    expect(session.meeting.status).toBe("LIVE");
    expect(session.realtime.topic).toMatch(/^room:/);
    expect(session.realtime.systemTopic).toBe(`${session.realtime.topic}:system`);
  });

  it("puts others in the waiting room until admitted, and announces it", async () => {
    const { deps, host, meeting, users, store } = await setup();
    await joinMeeting(deps, meeting.code, host, {}, ip);
    const { participant } = await joinMeeting(deps, meeting.code, users[0], {}, ip);
    expect(participant.status).toBe("WAITING");
    expect(store.published.some((p) => p.event.type === "waiting-changed")).toBe(true);

    expect(await code(issueRoomSession(deps, meeting.code, users[0]))).toBe("FORBIDDEN");
    await performHostAction(deps, meeting.code, host, { action: "admit", participantId: participant.id });
    expect(await code(issueRoomSession(deps, meeting.code, users[0]))).toBe("ok");
  });

  it("caps rooms at 6 active participants", async () => {
    const { deps, host, meeting, users } = await setup({ waitingRoom: false });
    await joinMeeting(deps, meeting.code, host, {}, ip);
    await issueRoomSession(deps, meeting.code, host);
    for (const u of users.slice(0, 5)) {
      await joinMeeting(deps, meeting.code, u, {}, ip);
      await issueRoomSession(deps, meeting.code, u);
    }
    expect(await code(joinMeeting(deps, meeting.code, users[5], {}, ip))).toBe("MEETING_FULL");
    await leaveMeeting(deps, meeting.code, users[0]);
    expect(await code(joinMeeting(deps, meeting.code, users[5], {}, ip))).toBe("ok");
  });

  it("only lets guests in when allowed, issuing a guest token", async () => {
    const closed = await setup();
    expect(await code(joinMeeting(closed.deps, closed.meeting.code, null, { displayName: "Gus" }, ip))).toBe(
      "GUESTS_NOT_ALLOWED",
    );

    const open = await setup({ allowGuests: true });
    const res = await joinMeeting(open.deps, open.meeting.code, null, { displayName: "Gus" }, ip);
    expect(res.participant.role).toBe("GUEST");
    expect(res.guestToken).toBeTruthy();
    const claims = await open.deps.tokens.verifyGuest(res.guestToken!);
    expect(claims.pid).toBe(res.participant.id);
  });

  it("blocks new joiners while locked", async () => {
    const { deps, host, meeting, users } = await setup();
    await joinMeeting(deps, meeting.code, host, {}, ip);
    await deps.meetings.update(meeting.id, { locked: true });
    expect(await code(joinMeeting(deps, meeting.code, users[0], {}, ip))).toBe("MEETING_LOCKED");
  });
});

describe("host controls & authorization", () => {
  async function inCall() {
    const s = await setup({ waitingRoom: false });
    await joinMeeting(s.deps, s.meeting.code, s.host, {}, ip);
    const { participant } = await joinMeeting(s.deps, s.meeting.code, s.users[0], {}, ip);
    return { ...s, member: s.users[0], memberId: participant.id };
  }

  it("rejects host actions from non-hosts", async () => {
    const { deps, meeting, member, memberId } = await inCall();
    expect(await code(performHostAction(deps, meeting.code, member, { action: "mute", participantId: memberId }))).toBe(
      "FORBIDDEN",
    );
  });

  it("removes a participant and keeps them out", async () => {
    const { deps, host, meeting, member, memberId, store } = await inCall();
    await performHostAction(deps, meeting.code, host, { action: "remove", participantId: memberId });
    expect(store.published.at(-2)?.event).toEqual({ type: "removed", participantId: memberId });
    expect(await code(issueRoomSession(deps, meeting.code, member))).toBe("FORBIDDEN");
    expect(await code(joinMeeting(deps, meeting.code, member, {}, ip))).toBe("FORBIDDEN");
  });

  it("transfers host", async () => {
    const { deps, host, meeting, member, memberId } = await inCall();
    await performHostAction(deps, meeting.code, host, { action: "transfer-host", participantId: memberId });
    expect(await code(performHostAction(deps, meeting.code, host, { action: "end" }))).toBe("FORBIDDEN");
    expect(await code(performHostAction(deps, meeting.code, member, { action: "end" }))).toBe("ok");
  });

  it("ending the meeting stops further joins and content", async () => {
    const { deps, host, meeting, member } = await inCall();
    await performHostAction(deps, meeting.code, host, { action: "end" });
    expect(await code(issueRoomSession(deps, meeting.code, member))).toBe("MEETING_ENDED");
    expect(await code(joinMeeting(deps, meeting.code, member, {}, ip))).toBe("MEETING_ENDED");
  });

  it("only members can post chat, get TURN, or upload files", async () => {
    const { deps, meeting, users, member } = await inCall();
    const outsider = users[3];
    const msg = { id: crypto.randomUUID(), keyId: "abcdefgh12", iv: "AAAAAAAAAAAAAAAA", ciphertext: "SGk=" };
    expect(await code(postChatMessage(deps, meeting.code, outsider, msg))).toBe("FORBIDDEN");
    expect(await code(getTurnCredentials(deps, meeting.code, outsider))).toBe("FORBIDDEN");
    expect(await code(postChatMessage(deps, meeting.code, member, msg))).toBe("ok");
    expect(await code(getTurnCredentials(deps, meeting.code, member))).toBe("ok");
  });

  it("verifies uploads before listing them", async () => {
    const { deps, meeting, member } = await inCall();
    const id = crypto.randomUUID();
    const { upload } = await createFileUpload(deps, meeting.code, member, {
      id,
      keyId: "abcdefgh12",
      iv: "AAAAAAAAAAAAAAAA",
      encryptedMeta: "AAAA",
      metaIv: "AAAAAAAAAAAAAAAA",
      sizeBytes: 1234,
    });
    expect(upload.url).toContain(`${meeting.id}/${id}.bin`);
    const done = await completeFileUpload(deps, meeting.code, member, id);
    expect(done.id).toBe(id);
  });
});
