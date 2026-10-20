import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import type { Actor } from "@/core/application/context";
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS, type SessionTokens } from "@/core/application/use-cases/issueSession";
import { DomainError, errors, isDomainError, type DomainErrorCode } from "@/core/domain/errors";
import { container } from "@/infrastructure/container";

export const ACCESS_COOKIE = "ms_at";
export const REFRESH_COOKIE = "ms_rt";
const REFRESH_PATH = "/api/auth";

const STATUS: Record<DomainErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 423,
  RATE_LIMITED: 429,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  MEETING_FULL: 409,
  MEETING_LOCKED: 403,
  MEETING_ENDED: 410,
  GUESTS_NOT_ALLOWED: 403,
  NOT_CONFIGURED: 503,
};

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of e.issues) {
      const key = issue.path.join(".") || "_";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return NextResponse.json(
      { error: { code: "VALIDATION", message: e.issues[0]?.message ?? "Invalid input.", fieldErrors } },
      { status: 400 },
    );
  }
  if (isDomainError(e)) {
    const res = NextResponse.json(
      { error: { code: e.code, message: e.message, ...e.details } },
      { status: STATUS[e.code] },
    );
    if (e.code === "RATE_LIMITED" && typeof e.details?.retryAfterSeconds === "number") {
      res.headers.set("Retry-After", String(e.details.retryAfterSeconds));
    }
    return res;
  }
  console.error("[api] unhandled error", e);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." } },
    { status: 500 },
  );
}

/** Rejects cross-site state-changing requests (cookies are SameSite=Lax, this is defense in depth). */
function assertSameOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (new URL(origin).host !== host) throw errors.forbidden("Cross-origin request blocked.");
    return;
  }
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw errors.forbidden("Cross-origin request blocked.");
}

export async function readJson(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (text.length > 64_000) throw errors.validation("Request body too large.");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw errors.validation("Malformed JSON body.");
  }
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Wraps a route handler with origin checks, error mapping and no-store caching. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      const res = await handler(req, ctx);
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (e) {
      return errorResponse(e);
    }
  };
}

const secure = process.env.NODE_ENV === "production";

export function setSessionCookies(res: NextResponse, session: Pick<SessionTokens, "accessToken" | "refreshToken">) {
  res.cookies.set(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TTL_SECONDS,
  });
  res.cookies.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: REFRESH_PATH,
    maxAge: REFRESH_TTL_SECONDS,
  });
  // Non-sensitive hint so the proxy can tell signed-in visitors apart without the refresh cookie.
  res.cookies.set("ms_session", "1", { secure, sameSite: "lax", path: "/", maxAge: REFRESH_TTL_SECONDS });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, secure, sameSite: "strict", path: REFRESH_PATH, maxAge: 0 });
  res.cookies.set("ms_session", "", { path: "/", maxAge: 0 });
}

export const guestCookieName = (code: string) => `ms_guest_${code.replace(/-/g, "")}`;

export function setGuestCookie(res: NextResponse, code: string, token: string) {
  res.cookies.set(guestCookieName(code), token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}

/** Signed-in user from the access cookie, or null. Expired tokens surface as TOKEN_EXPIRED. */
export async function optionalUser(req: NextRequest): Promise<Extract<Actor, { kind: "user" }> | null> {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) {
    // A refresh cookie means the client can recover; tell it to refresh instead of acting anonymous.
    if (req.cookies.has("ms_session")) throw errors.tokenExpired();
    return null;
  }
  const claims = await container().tokens.verifyAccess(token);
  return { kind: "user", userId: claims.sub, name: claims.name };
}

export async function requireUser(req: NextRequest) {
  const user = await optionalUser(req);
  if (!user) throw errors.unauthenticated();
  return user;
}

/** Resolves the caller for a meeting route: a signed-in user first, then that meeting's guest cookie. */
export async function optionalActor(req: NextRequest, code: string): Promise<Actor | null> {
  const user = await optionalUser(req).catch((e: unknown) => {
    if (e instanceof DomainError && e.code === "TOKEN_EXPIRED" && req.cookies.has(guestCookieName(code))) return null;
    throw e;
  });
  if (user) return user;
  const guest = req.cookies.get(guestCookieName(code))?.value;
  if (!guest) return null;
  try {
    const claims = await container().tokens.verifyGuest(guest);
    return { kind: "guest", participantId: claims.pid, meetingId: claims.mid, name: claims.name };
  } catch {
    return null;
  }
}

export async function requireActor(req: NextRequest, code: string): Promise<Actor> {
  const actor = await optionalActor(req, code);
  if (!actor) throw errors.unauthenticated("Join the meeting first.");
  return actor;
}

export const json = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);
