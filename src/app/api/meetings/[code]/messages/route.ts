import type { NextRequest } from "next/server";
import { listChatMessages, postChatMessage } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { meetingCodeSchema } from "@/lib/schemas/meeting";
import { json, readJson, requireActor, route } from "@/lib/server/http";

type Ctx = RouteContext<"/api/meetings/[code]/messages">;

export const GET = route(async (req: NextRequest, ctx: Ctx) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  const before = req.nextUrl.searchParams.get("before") ?? undefined;
  return json(await listChatMessages(container(), code, await requireActor(req, code), before));
});

export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  const message = await postChatMessage(container(), code, await requireActor(req, code), await readJson(req));
  return json({ message }, { status: 201 });
});
