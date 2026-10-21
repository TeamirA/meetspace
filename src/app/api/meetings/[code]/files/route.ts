import type { NextRequest } from "next/server";
import { createFileUpload, listFiles } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { meetingCodeSchema } from "@/lib/schemas/meeting";
import { json, readJson, requireActor, route } from "@/lib/server/http";

type Ctx = RouteContext<"/api/meetings/[code]/files">;

export const GET = route(async (req: NextRequest, ctx: Ctx) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  return json(await listFiles(container(), code, await requireActor(req, code)));
});

export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  return json(await createFileUpload(container(), code, await requireActor(req, code), await readJson(req)), {
    status: 201,
  });
});
