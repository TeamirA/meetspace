import { toParticipantDto } from "../dtos";
import { requireAdmitted, requireMeeting, type Actor, type Deps } from "../context";

/** Members see admitted participants; the host also sees the waiting room queue. */
export async function listParticipants(deps: Pick<Deps, "meetings" | "participants">, code: string, actor: Actor) {
  const meeting = await requireMeeting(deps, code);
  const me = await requireAdmitted(deps, meeting, actor);
  const statuses = me.role === "HOST" ? (["ADMITTED", "WAITING"] as const) : (["ADMITTED"] as const);
  const list = await deps.participants.listByMeeting(meeting.id, [...statuses]);
  return { items: list.map(toParticipantDto) };
}
