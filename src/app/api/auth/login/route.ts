import type { NextRequest } from "next/server";
import { loginUser } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { clientIp, json, readJson, route, setSessionCookies } from "@/lib/server/http";

export const POST = route(async (req: NextRequest) => {
  const session = await loginUser(container(), await readJson(req), {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });
  const res = json({ user: session.user });
  setSessionCookies(res, session);
  return res;
});
