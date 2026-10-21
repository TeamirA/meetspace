import { requireAdmitted, requireMeeting, type Actor, type Deps } from "../context";

export async function getWhiteboard(
  deps: Pick<Deps, "meetings" | "participants" | "whiteboards">,
  code: string,
  actor: Actor,
) {
  const meeting = await requireMeeting(deps, code);
  await requireAdmitted(deps, meeting, actor);
  const board = await deps.whiteboards.find(meeting.id);
  return {
    elements: board?.elements ?? [],
    version: board?.version ?? 0,
    updatedAt: board?.updatedAt.toISOString() ?? null,
  };
}
