import type { NextRequest } from "next/server";
import { z } from "zod";
import { getFileDownloadUrl } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { meetingCodeSchema } from "@/lib/schemas/meeting";
import { json, requireActor, route } from "@/lib/server/http";

/** Returns a 60-second signed URL for the encrypted object; decryption happens in the browser. */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/meetings/[code]/files/[fileId]">) => {
  const params = await ctx.params;
  const code = meetingCodeSchema.parse(params.code);
  const fileId = z.uuid().parse(params.fileId);
  return json(await getFileDownloadUrl(container(), code, await requireActor(req, code), fileId));
});
