import { errors } from "@/core/domain/errors";
import { toMeetingDto, toParticipantDto, type RoomSessionDto } from "../dtos";
import { requireAdmitted, requireMeeting, roomTopics, type Actor, type Deps } from "../context";

export const ROOM_TOKEN_TTL_SECONDS = 10 * 60;

/**
 * Issues the Realtime credentials for an admitted member. The token is scoped by RLS to this
 * meeting's topics only, so non-members can neither listen to nor publish signaling messages.
 * Called on join and again before expiry (it doubles as a presence heartbeat).
 */
export async function issueRoomSession(
  deps: Pick<Deps, "meetings" | "participants" | "roomTokens" | "clock">,
  code: string,
  actor: Actor,
): Promise<RoomSessionDto> {
  const meeting = await requireMeeting(deps, code);
  if (meeting.status === "ENDED") throw errors.meetingEnded();
  const participant = await requireAdmitted(deps, meeting, actor);
  const now = deps.clock.now();

  const updated = await deps.participants.update(participant.id, {
    lastSeenAt: now,
    joinedAt: participant.joinedAt ?? now,
    leftAt: null,
  });
  const { topic, systemTopic } = roomTopics(deps, meeting);
  const token = await deps.roomTokens.issue({
    participantId: participant.id,
    topic,
    systemTopic,
    ttlSeconds: ROOM_TOKEN_TTL_SECONDS,
  });
  return {
    participant: toParticipantDto(updated),
    meeting: toMeetingDto(meeting),
    realtime: {
      token,
      topic,
      systemTopic,
      expiresAt: new Date(now.getTime() + ROOM_TOKEN_TTL_SECONDS * 1000).toISOString(),
    },
  };
}
