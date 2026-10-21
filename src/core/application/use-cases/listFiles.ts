import { toSharedFileDto } from "../dtos";
import { requireAdmitted, requireMeeting, type Actor, type Deps } from "../context";

export async function listFiles(deps: Pick<Deps, "meetings" | "participants" | "files">, code: string, actor: Actor) {
  const meeting = await requireMeeting(deps, code);
  await requireAdmitted(deps, meeting, actor);
  const files = await deps.files.listByMeeting(meeting.id);
  return { items: files.filter((f) => f.uploaded).map(toSharedFileDto) };
}
