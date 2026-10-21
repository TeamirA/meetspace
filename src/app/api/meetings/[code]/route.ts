import type { NextRequest } from "next/server";
import { deleteMeeting, getMeetingPreview, updateMeetingSettings } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { meetingCodeSchema } from "@/lib/schemas/meeting";
import { json, optionalActor, readJson, requireActor, requireUser, route } from "@/lib/server/http";

type Ctx = RouteContext<"/api/meetings/[code]">;

export const GET = route(async (req: NextRequest, ctx: Ctx) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  const actor = await optionalActor(req, code).catch(() => null);
  return json({ meeting: await getMeetingPreview(container(), code, actor) });
});

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  const actor = await requireActor(req, code);
  return json({ meeting: await updateMeetingSettings(container(), code, actor, await readJson(req)) });
});

export const DELETE = route(async (req: NextRequest, ctx: Ctx) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  const actor = await requireUser(req);
  return json(await deleteMeeting(container(), code, actor.userId));
});
