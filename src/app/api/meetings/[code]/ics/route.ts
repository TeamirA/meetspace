import type { NextRequest } from "next/server";
import { errors } from "@/core/domain/errors";
import { container } from "@/infrastructure/container";
import { buildIcs } from "@/lib/ics";
import { meetingCodeSchema } from "@/lib/schemas/meeting";
import { requireUser, route } from "@/lib/server/http";

/** Add-to-calendar download for a scheduled meeting the user hosts or joined. */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/meetings/[code]/ics">) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  await requireUser(req);
  const meeting = await container().meetings.findByCode(code);
  if (!meeting || !meeting.scheduledFor) throw errors.notFound("Scheduled meeting");
  const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const ics = buildIcs({
    uid: `${meeting.id}@meetspace`,
    title: meeting.title,
    description: meeting.description ?? undefined,
    start: meeting.scheduledFor,
    durationMinutes: meeting.durationMinutes,
    url: `${origin}/m/${meeting.code}`,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${meeting.code}.ics"`,
    },
  });
});
