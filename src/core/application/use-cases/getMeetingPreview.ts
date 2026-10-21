import type { MeetingPreviewDto } from "../dtos";
import { requireMeeting, type Actor, type Deps } from "../context";

/** Public, minimal information shown in the lobby before someone joins. */
export async function getMeetingPreview(
  deps: Pick<Deps, "meetings" | "users">,
  code: string,
  actor: Actor | null,
): Promise<MeetingPreviewDto> {
  const meeting = await requireMeeting(deps, code);
  const host = await deps.users.findById(meeting.hostId);
  return {
    code: meeting.code,
    title: meeting.title,
    status: meeting.status,
    scheduledFor: meeting.scheduledFor?.toISOString() ?? null,
    allowGuests: meeting.allowGuests,
    locked: meeting.locked,
    e2eeMedia: meeting.e2eeMedia,
    hostName: host?.displayName ?? "Host",
    isHost: actor?.kind === "user" && actor.userId === meeting.hostId,
  };
}
