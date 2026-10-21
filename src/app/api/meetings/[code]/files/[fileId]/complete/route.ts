import type { NextRequest } from "next/server";
import { z } from "zod";
import { completeFileUpload } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { meetingCodeSchema } from "@/lib/schemas/meeting";
import { json, requireActor, route } from "@/lib/server/http";

export const POST = route(
  async (req: NextRequest, ctx: RouteContext<"/api/meetings/[code]/files/[fileId]/complete">) => {
    const params = await ctx.params;
    const code = meetingCodeSchema.parse(params.code);
    const fileId = z.uuid().parse(params.fileId);
    return json({ file: await completeFileUpload(container(), code, await requireActor(req, code), fileId) });
  },
);
