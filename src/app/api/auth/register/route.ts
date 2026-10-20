import type { NextRequest } from "next/server";
import { registerUser } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { clientIp, json, readJson, route, setSessionCookies } from "@/lib/server/http";

export const POST = route(async (req: NextRequest) => {
  const session = await registerUser(container(), await readJson(req), {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });
  const res = json({ user: session.user }, { status: 201 });
  setSessionCookies(res, session);
  return res;
});
