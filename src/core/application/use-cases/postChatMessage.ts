import { errors } from "@/core/domain/errors";
import { chatMessageSchema } from "@/lib/schemas/content";
import { toChatMessageDto } from "../dtos";
import { enforceRateLimit, requireAdmitted, requireMeeting, type Actor, type Deps } from "../context";

/** Stores an already-encrypted chat message. The server never sees the plaintext or the key. */
export async function postChatMessage(
  deps: Pick<Deps, "meetings" | "participants" | "messages" | "rateLimits" | "clock">,
  code: string,
  actor: Actor,
  input: unknown,
) {
  const data = chatMessageSchema.parse(input);
  const meeting = await requireMeeting(deps, code);
  if (meeting.status === "ENDED") throw errors.meetingEnded();
  const p = await requireAdmitted(deps, meeting, actor);
  await enforceRateLimit(deps, `chat:${p.id}`, 60, 60_000);
  const msg = await deps.messages.create({ ...data, meetingId: meeting.id, participantId: p.id });
  return toChatMessageDto(msg);
}
