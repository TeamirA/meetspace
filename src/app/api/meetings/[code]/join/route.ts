import type { NextRequest } from "next/server";
import { joinMeeting } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { meetingCodeSchema } from "@/lib/schemas/meeting";
import { clientIp, json, optionalActor, readJson, route, setGuestCookie } from "@/lib/server/http";

export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/meetings/[code]/join">) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  const actor = await optionalActor(req, code);
  const result = await joinMeeting(container(), code, actor, await readJson(req), { ip: clientIp(req) });
  const res = json({ participant: result.participant });
  if (result.guestToken) setGuestCookie(res, code, result.guestToken);
  return res;
});
