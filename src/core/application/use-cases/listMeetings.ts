import { listMeetingsQuerySchema } from "@/lib/schemas/meeting";
import { toMeetingDto } from "../dtos";
import type { Deps } from "../context";

export async function listMeetings(deps: Pick<Deps, "meetings" | "clock">, userId: string, query: unknown) {
  const { scope, cursor } = listMeetingsQuerySchema.parse(query);
  const now = deps.clock.now();
  const items =
    scope === "upcoming"
      ? await deps.meetings.listUpcomingForUser(userId, now, 50)
      : scope === "recent"
        ? await deps.meetings.listRecentForUser(userId, 12)
        : await deps.meetings.listHistoryForUser(userId, 20, cursor);
  return {
    items: items.map(toMeetingDto),
    nextCursor: scope === "history" && items.length === 20 ? items[items.length - 1].id : null,
  };
}
