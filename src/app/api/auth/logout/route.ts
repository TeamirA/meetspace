import type { NextRequest } from "next/server";
import { logoutUser } from "@/core/application/use-cases";
import { container } from "@/infrastructure/container";
import { clearSessionCookies, json, REFRESH_COOKIE, route } from "@/lib/server/http";

export const POST = route(async (req: NextRequest) => {
  await logoutUser(container(), req.cookies.get(REFRESH_COOKIE)?.value);
  const res = json({ ok: true });
  clearSessionCookies(res);
  return res;
});
