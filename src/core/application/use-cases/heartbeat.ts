import { errors } from "@/core/domain/errors";
import { requireAdmitted, requireMeeting, type Actor, type Deps } from "../context";

/** Keeps the participant counted as active (for the capacity cap) while their tab is open. */
export async function heartbeat(deps: Pick<Deps, "meetings" | "participants" | "clock">, code: string, actor: Actor) {
  const meeting = await requireMeeting(deps, code);
  if (meeting.status === "ENDED") throw errors.meetingEnded();
  const p = await requireAdmitted(deps, meeting, actor);
  await deps.participants.update(p.id, { lastSeenAt: deps.clock.now() });
  return { ok: true as const };
}
