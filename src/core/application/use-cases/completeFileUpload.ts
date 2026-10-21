import { errors } from "@/core/domain/errors";
import { toSharedFileDto } from "../dtos";
import { requireAdmitted, requireMeeting, type Actor, type Deps } from "../context";

/** Confirms the object landed in Storage with the declared size before listing it for others. */
export async function completeFileUpload(
  deps: Pick<Deps, "meetings" | "participants" | "files" | "storage">,
  code: string,
  actor: Actor,
  fileId: string,
) {
  const meeting = await requireMeeting(deps, code);
  const p = await requireAdmitted(deps, meeting, actor);
  const file = await deps.files.findById(fileId);
  if (!file || file.meetingId !== meeting.id) throw errors.notFound("File");
  if (file.participantId !== p.id) throw errors.forbidden();

  const stat = await deps.storage.exists(file.storagePath);
  if (!stat.exists) throw errors.validation("Upload not found. Please try again.");
  if (stat.size !== undefined && stat.size !== file.sizeBytes) {
    await deps.storage.remove([file.storagePath]).catch(() => undefined);
    await deps.files.delete(file.id);
    throw errors.validation("Uploaded file size didn't match. Please try again.");
  }
  return toSharedFileDto(await deps.files.markUploaded(file.id));
}
