import type { NextRequest } from "next/server";
import { leaveMeeting } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { meetingCodeSchema } from "@/lib/schemas/meeting";
import { json, optionalActor, route } from "@/lib/server/http";

/** Called with navigator.sendBeacon on tab close, so it tolerates an expired access token. */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/meetings/[code]/leave">) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  const actor = await optionalActor(req, code).catch(() => null);
  if (!actor) return json({ ok: true });
  return json(await leaveMeeting(container(), code, actor));
});
