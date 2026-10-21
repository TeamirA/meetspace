import type { NextRequest } from "next/server";
import { getMyParticipant } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { meetingCodeSchema } from "@/lib/schemas/meeting";
import { json, requireActor, route } from "@/lib/server/http";

export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/meetings/[code]/me">) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  return json(await getMyParticipant(container(), code, await requireActor(req, code)));
});
