import { updateMeetingSchema } from "@/lib/schemas/meeting";
import { toMeetingDto } from "../dtos";
import { requireHost, requireMeeting, roomTopics, type Actor, type Deps } from "../context";

export async function updateMeetingSettings(
  deps: Pick<Deps, "meetings" | "participants" | "broadcaster" | "roomTokens">,
  code: string,
  actor: Actor,
  input: unknown,
) {
  const data = updateMeetingSchema.parse(input);
  const meeting = await requireMeeting(deps, code);
  await requireHost(deps, meeting, actor);
  const updated = await deps.meetings.update(meeting.id, data);
  await deps.broadcaster
    .publish(roomTopics(deps, meeting).systemTopic, { type: "meeting-updated", locked: updated.locked })
    .catch((e) => console.warn("[meeting-settings] broadcast failed", e));
  return toMeetingDto(updated);
}
