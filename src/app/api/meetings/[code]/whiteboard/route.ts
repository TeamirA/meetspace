import type { NextRequest } from "next/server";
import { getWhiteboard, saveWhiteboard } from "@/core/application/use-cases";
import { errors } from "@/core/domain/errors";
import { container } from "@/infrastructure/container";
import { meetingCodeSchema } from "@/lib/schemas/meeting";
import { json, requireActor, route } from "@/lib/server/http";

type Ctx = RouteContext<"/api/meetings/[code]/whiteboard">;

export const GET = route(async (req: NextRequest, ctx: Ctx) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  return json(await getWhiteboard(container(), code, await requireActor(req, code)));
});

export const PUT = route(async (req: NextRequest, ctx: Ctx) => {
  const code = meetingCodeSchema.parse((await ctx.params).code);
  const text = await req.text();
  // Boards can be large; allow up to ~3 MB (below Vercel's 4.5 MB request limit).
  if (text.length > 3_000_000) throw errors.validation("Whiteboard is too large to save.");
  let body: unknown;
  try {
    body = JSON.parse(text || "{}");
  } catch {
    throw errors.validation("Malformed JSON body.");
  }
  return json(await saveWhiteboard(container(), code, await requireActor(req, code), body));
});
