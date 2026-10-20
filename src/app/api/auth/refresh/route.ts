import type { NextRequest } from "next/server";
import { refreshSession } from "@/core/application/use-cases";
import { isDomainError } from "@/core/domain/errors";
import { container } from "@/infrastructure/container";
import { clearSessionCookies, errorResponse, json, REFRESH_COOKIE, route, setSessionCookies } from "@/lib/server/http";

/** Rotates the refresh token. On failure the stale cookies are cleared so the client signs in again. */
export const POST = route(async (req: NextRequest) => {
  try {
    const session = await refreshSession(container(), req.cookies.get(REFRESH_COOKIE)?.value, {
      userAgent: req.headers.get("user-agent"),
    });
    const res = json({ user: session.user });
    setSessionCookies(res, session);
    return res;
  } catch (e) {
    const res = errorResponse(e);
    if (isDomainError(e) && e.code === "UNAUTHENTICATED") clearSessionCookies(res);
    return res;
  }
});
