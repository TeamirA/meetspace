import type { NextRequest } from "next/server";
import { performHostAction } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { meetingCodeSchema } from "@/lib/schemas/meeting";
import { json, readJson, requireActor, route } from "@/lib/server/http";

export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/meetings/[code]/host">) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  return json(await performHostAction(container(), code, await requireActor(req, code), await readJson(req)));
});
