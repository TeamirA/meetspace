import { errors } from "@/core/domain/errors";
import { toParticipantDto } from "../dtos";
import { findMembership, requireMeeting, type Actor, type Deps } from "../context";

/** Polled from the waiting room to learn whether the host admitted or denied the request. */
export async function getMyParticipant(deps: Pick<Deps, "meetings" | "participants">, code: string, actor: Actor) {
  const meeting = await requireMeeting(deps, code);
  const p = await findMembership(deps, meeting, actor);
  if (!p) throw errors.notFound("Participant");
  return { participant: toParticipantDto(p), meetingStatus: meeting.status };
}
