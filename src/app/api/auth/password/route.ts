import type { NextRequest } from "next/server";
import { changePassword } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { json, readJson, requireUser, route, setSessionCookies } from "@/lib/server/http";

export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req);
  const session = await changePassword(container(), actor.userId, await readJson(req), {
    userAgent: req.headers.get("user-agent"),
  });
  const res = json({ user: session.user });
  setSessionCookies(res, session);
  return res;
});
