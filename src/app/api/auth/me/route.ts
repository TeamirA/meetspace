import type { NextRequest } from "next/server";
import { getCurrentUser, updateProfile } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { json, optionalUser, readJson, requireUser, route } from "@/lib/server/http";

/** Visitors get `{ user: null }`; an expired access token still answers 401 so the client refreshes. */
export const GET = route(async (req: NextRequest) => {
  const actor = await optionalUser(req);
  if (!actor) return json({ user: null });
  return json({ user: await getCurrentUser(container(), actor.userId) });
});

export const PATCH = route(async (req: NextRequest) => {
  const actor = await requireUser(req);
  return json({ user: await updateProfile(container(), actor.userId, await readJson(req)) });
});
