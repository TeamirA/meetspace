import { errors } from "@/core/domain/errors";
import { requireMeeting, type Deps } from "../context";

/** Hosts can cancel a meeting that hasn't started; stored files are removed with it. */
export async function deleteMeeting(deps: Pick<Deps, "meetings" | "files" | "storage">, code: string, userId: string) {
  const meeting = await requireMeeting(deps, code);
  if (meeting.hostId !== userId) throw errors.forbidden("Only the host can delete this meeting.");
  if (meeting.status === "LIVE") throw errors.conflict("End the meeting before deleting it.");
  const files = await deps.files.listByMeeting(meeting.id);
  if (files.length) await deps.storage.remove(files.map((f) => f.storagePath)).catch(() => undefined);
  await deps.meetings.delete(meeting.id);
  return { ok: true as const };
}
