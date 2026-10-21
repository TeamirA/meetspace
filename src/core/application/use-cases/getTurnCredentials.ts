import type { IceServer } from "../ports";
import { requireAdmitted, requireMeeting, type Actor, type Deps } from "../context";

export const TURN_TTL_SECONDS = 4 * 60 * 60;

/** Short-lived ICE servers, only for admitted members so the TURN relay can't be freeloaded. */
export async function getTurnCredentials(
  deps: Pick<Deps, "meetings" | "participants" | "turn">,
  code: string,
  actor: Actor,
): Promise<{ iceServers: IceServer[]; ttl: number }> {
  const meeting = await requireMeeting(deps, code);
  await requireAdmitted(deps, meeting, actor);
  const iceServers = await deps.turn.getIceServers(TURN_TTL_SECONDS);
  return { iceServers, ttl: TURN_TTL_SECONDS };
}
