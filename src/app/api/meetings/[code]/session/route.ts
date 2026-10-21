import type { NextRequest } from "next/server";
import { issueRoomSession } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { meetingCodeSchema } from "@/lib/schemas/meeting";
import { json, requireActor, route } from "@/lib/server/http";

export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/meetings/[code]/session">) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  return json(await issueRoomSession(container(), code, await requireActor(req, code)));
});
