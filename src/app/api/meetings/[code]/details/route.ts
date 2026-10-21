import type { NextRequest } from "next/server";
import { getMeetingDetails } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { meetingCodeSchema } from "@/lib/schemas/meeting";
import { json, requireUser, route } from "@/lib/server/http";

export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/meetings/[code]/details">) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  const actor = await requireUser(req);
  return json(await getMeetingDetails(container(), code, actor.userId));
});
