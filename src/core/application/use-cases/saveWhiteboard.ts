import { errors } from "@/core/domain/errors";
import type { BoardElement } from "@/core/domain/entities";
import { saveWhiteboardSchema } from "@/lib/schemas/content";
import { enforceRateLimit, requireAdmitted, requireMeeting, type Actor, type Deps } from "../context";

/** Persists a board snapshot so it survives the meeting and can be viewed in history. */
export async function saveWhiteboard(
  deps: Pick<Deps, "meetings" | "participants" | "whiteboards" | "rateLimits" | "clock">,
  code: string,
  actor: Actor,
  input: unknown,
) {
  const data = saveWhiteboardSchema.parse(input);
  const meeting = await requireMeeting(deps, code);
  if (meeting.status === "ENDED") throw errors.meetingEnded();
  const p = await requireAdmitted(deps, meeting, actor);
  await enforceRateLimit(deps, `whiteboard:${p.id}`, 60, 60_000);
  const board = await deps.whiteboards.save(meeting.id, data.elements as BoardElement[]);
  return { version: board.version, updatedAt: board.updatedAt.toISOString() };
}
