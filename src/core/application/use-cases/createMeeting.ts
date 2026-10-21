import { generateMeetingCode } from "@/core/domain/entities";
import { errors } from "@/core/domain/errors";
import { createMeetingSchema } from "@/lib/schemas/meeting";
import { toMeetingDto } from "../dtos";
import { enforceRateLimit, type Deps } from "../context";

/** Creates an instant meeting (no `scheduledFor`) or a scheduled one. */
export async function createMeeting(
  deps: Pick<Deps, "meetings" | "rateLimits" | "clock">,
  hostId: string,
  input: unknown,
) {
  await enforceRateLimit(deps, `create-meeting:${hostId}`, 30, 60 * 60_000);
  const data = createMeetingSchema.parse(input);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateMeetingCode();
    if (await deps.meetings.findByCode(code)) continue;
    const meeting = await deps.meetings.create({
      code,
      title: data.title,
      description: data.description ?? null,
      hostId,
      status: "SCHEDULED",
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
      durationMinutes: data.durationMinutes,
      allowGuests: data.allowGuests,
      waitingRoom: data.waitingRoom,
      e2eeMedia: data.e2eeMedia,
    });
    return toMeetingDto(meeting);
  }
  throw errors.conflict("Could not allocate a meeting code. Please try again.");
}
