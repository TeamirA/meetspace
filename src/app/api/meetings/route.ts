import type { NextRequest } from "next/server";
import { createMeeting, listMeetings } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { json, readJson, requireUser, route } from "@/lib/server/http";

export const GET = route(async (req: NextRequest) => {
  const actor = await requireUser(req);
  const query = Object.fromEntries(req.nextUrl.searchParams);
  return json(await listMeetings(container(), actor.userId, query));
});

export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req);
  return json({ meeting: await createMeeting(container(), actor.userId, await readJson(req)) }, { status: 201 });
});
