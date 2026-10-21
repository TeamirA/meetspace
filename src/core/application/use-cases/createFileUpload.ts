import { storagePathFor } from "@/core/domain/entities";
import { errors } from "@/core/domain/errors";
import { createFileSchema } from "@/lib/schemas/content";
import { toSharedFileDto } from "../dtos";
import { enforceRateLimit, requireAdmitted, requireMeeting, type Actor, type Deps } from "../context";

/**
 * Registers an encrypted file and returns a one-time signed upload URL. The browser uploads
 * ciphertext directly to Storage, which keeps large files off the serverless functions.
 */
export async function createFileUpload(
  deps: Pick<Deps, "meetings" | "participants" | "files" | "storage" | "rateLimits" | "clock">,
  code: string,
  actor: Actor,
  input: unknown,
) {
  const data = createFileSchema.parse(input);
  const meeting = await requireMeeting(deps, code);
  if (meeting.status === "ENDED") throw errors.meetingEnded();
  const p = await requireAdmitted(deps, meeting, actor);
  await enforceRateLimit(deps, `file:${p.id}`, 20, 10 * 60_000);

  const storagePath = storagePathFor(meeting.id, data.id);
  const file = await deps.files.create({ ...data, meetingId: meeting.id, participantId: p.id, storagePath });
  const upload = await deps.storage.createUploadUrl(storagePath);
  return { file: toSharedFileDto(file), upload };
}
