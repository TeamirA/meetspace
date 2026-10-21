import { decideJoin, isActive, MAX_PARTICIPANTS, PRESENCE_TIMEOUT_MS } from "@/core/domain/entities";
import { errors } from "@/core/domain/errors";
import { joinMeetingSchema } from "@/lib/schemas/meeting";
import { toParticipantDto } from "../dtos";
import { enforceRateLimit, findMembership, requireMeeting, roomTopics, type Actor, type Deps } from "../context";

export interface JoinResult {
  participant: ReturnType<typeof toParticipantDto>;
  /** Set when a new guest participant was created; the route stores it in an httpOnly cookie. */
  guestToken?: string;
}

/**
 * Requests to join. The host (and returning admitted members) get straight in; others land in
 * the waiting room when it is enabled. Lock, capacity and guest rules are enforced here.
 */
export async function joinMeeting(
  deps: Pick<Deps, "meetings" | "participants" | "tokens" | "broadcaster" | "roomTokens" | "rateLimits" | "clock">,
  code: string,
  actor: Actor | null,
  input: unknown,
  meta: { ip: string },
): Promise<JoinResult> {
  await enforceRateLimit(deps, `join:ip:${meta.ip}`, 60, 10 * 60_000);
  const meeting = await requireMeeting(deps, code);
  const data = joinMeetingSchema.parse(input ?? {});
  const now = deps.clock.now();

  const existing = actor ? await findMembership(deps, meeting, actor) : null;
  const isHost = actor?.kind === "user" && actor.userId === meeting.hostId;
  const isGuest = !actor || actor.kind === "guest";
  if (isGuest && !actor && !data.displayName) throw errors.validation("Enter your name to join as a guest.");

  const activeCount = await deps.participants.countActive(meeting.id, new Date(now.getTime() - PRESENCE_TIMEOUT_MS));
  const decision = decideJoin({
    meeting,
    isHost,
    isGuest,
    existing,
    activeCount,
    alreadyActive: existing ? isActive(existing, now) : false,
  });

  if (decision.kind === "reject") {
    switch (decision.reason) {
      case "LOCKED":
        throw errors.meetingLocked();
      case "FULL":
        throw errors.meetingFull(MAX_PARTICIPANTS);
      case "ENDED":
        throw errors.meetingEnded();
      case "GUESTS_NOT_ALLOWED":
        throw errors.guestsNotAllowed();
      case "REMOVED":
        throw errors.forbidden("The host removed you from this meeting.");
    }
  }
  if (isHost && activeCount >= MAX_PARTICIPANTS && !(existing && isActive(existing, now))) {
    throw errors.meetingFull(MAX_PARTICIPANTS);
  }

  const status = decision.kind === "admit" ? "ADMITTED" : "WAITING";
  const displayName = data.displayName ?? actor?.name ?? "Guest";
  const role = isHost ? "HOST" : isGuest ? "GUEST" : (existing?.role ?? "PARTICIPANT");

  const participant = existing
    ? await deps.participants.update(existing.id, {
        status: existing.status === "ADMITTED" ? "ADMITTED" : status,
        displayName,
        role: existing.role === "HOST" ? "HOST" : role,
        leftAt: null,
      })
    : await deps.participants.create({
        meetingId: meeting.id,
        userId: actor?.kind === "user" ? actor.userId : null,
        displayName,
        role,
        status,
      });

  if (participant.status === "ADMITTED") {
    // First admission starts the meeting (a host may also restart an ended one).
    if (meeting.status !== "LIVE") {
      await deps.meetings.update(meeting.id, { status: "LIVE", startedAt: now, endedAt: null });
    } else if (meeting.endedAt) {
      await deps.meetings.update(meeting.id, { endedAt: null });
    }
  }

  if (participant.status === "WAITING") {
    await deps.broadcaster
      .publish(roomTopics(deps, meeting).systemTopic, { type: "waiting-changed" })
      .catch(() => undefined);
  }

  const guestToken =
    !actor && participant.role === "GUEST"
      ? await deps.tokens.signGuest({ pid: participant.id, mid: meeting.id, name: displayName })
      : undefined;
  return { participant: toParticipantDto(participant), guestToken };
}
