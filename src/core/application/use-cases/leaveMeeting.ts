import { PRESENCE_TIMEOUT_MS } from "@/core/domain/entities";
import { findMembership, requireMeeting, type Actor, type Deps } from "../context";

/**
 * Marks the caller as gone. Membership stays ADMITTED so a refresh or quick rejoin does not
 * send them back to the waiting room. When the room empties, `endedAt` records the duration.
 */
export async function leaveMeeting(
  deps: Pick<Deps, "meetings" | "participants" | "clock">,
  code: string,
  actor: Actor,
) {
  const meeting = await requireMeeting(deps, code);
  const p = await findMembership(deps, meeting, actor);
  if (!p) return { ok: true as const };
  const now = deps.clock.now();
  await deps.participants.update(p.id, {
    leftAt: now,
    lastSeenAt: null,
    status: p.status === "WAITING" ? "LEFT" : p.status,
  });
  if (meeting.status === "LIVE") {
    const remaining = await deps.participants.countActive(meeting.id, new Date(now.getTime() - PRESENCE_TIMEOUT_MS));
    if (remaining === 0) await deps.meetings.update(meeting.id, { endedAt: now });
  }
  return { ok: true as const };
}
