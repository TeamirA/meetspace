import { meetingDurationMs } from "@/core/domain/entities";
import { errors } from "@/core/domain/errors";
import { toMeetingDto, toParticipantDto, toSharedFileDto } from "../dtos";
import { requireMeeting, type Deps } from "../context";

/** History view of one meeting for a signed-in user who took part in it (or hosts it). */
export async function getMeetingDetails(
  deps: Pick<Deps, "meetings" | "participants" | "files" | "whiteboards">,
  code: string,
  userId: string,
) {
  const meeting = await requireMeeting(deps, code);
  const me = await deps.participants.findByMeetingAndUser(meeting.id, userId);
  const wasMember = me && (me.status === "ADMITTED" || me.status === "LEFT" || me.joinedAt);
  if (meeting.hostId !== userId && !wasMember) throw errors.forbidden();

  const [participants, files, board] = await Promise.all([
    deps.participants.listByMeeting(meeting.id),
    deps.files.listByMeeting(meeting.id),
    deps.whiteboards.find(meeting.id),
  ]);
  const end = meeting.endedAt ?? null;
  return {
    meeting: toMeetingDto(meeting),
    durationMs: meetingDurationMs({ startedAt: meeting.startedAt, endedAt: end }),
    myParticipantId: me?.id ?? null,
    participants: participants.filter((p) => p.joinedAt).map(toParticipantDto),
    files: files.filter((f) => f.uploaded).map(toSharedFileDto),
    whiteboard: board ? { elements: board.elements, updatedAt: board.updatedAt.toISOString() } : null,
  };
}
