import { toChatMessageDto } from "../dtos";
import { requireAdmitted, requireMeeting, type Actor, type Deps } from "../context";

export async function listChatMessages(
  deps: Pick<Deps, "meetings" | "participants" | "messages">,
  code: string,
  actor: Actor,
  before?: string,
) {
  const meeting = await requireMeeting(deps, code);
  await requireAdmitted(deps, meeting, actor);
  const beforeDate = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : undefined;
  const list = await deps.messages.listByMeeting(meeting.id, 200, beforeDate);
  return { items: list.map(toChatMessageDto) };
}
