import { errors } from "@/core/domain/errors";
import { requireAdmitted, requireMeeting, type Actor, type Deps } from "../context";

export const DOWNLOAD_URL_TTL_SECONDS = 60;

export async function getFileDownloadUrl(
  deps: Pick<Deps, "meetings" | "participants" | "files" | "storage">,
  code: string,
  actor: Actor,
  fileId: string,
) {
  const meeting = await requireMeeting(deps, code);
  await requireAdmitted(deps, meeting, actor);
  const file = await deps.files.findById(fileId);
  if (!file || file.meetingId !== meeting.id || !file.uploaded) throw errors.notFound("File");
  const url = await deps.storage.createDownloadUrl(file.storagePath, DOWNLOAD_URL_TTL_SECONDS);
  return { url, expiresIn: DOWNLOAD_URL_TTL_SECONDS };
}
