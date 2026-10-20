import { NextResponse, type NextRequest } from "next/server";

// The refresh cookie is scoped to /api/auth, so pages rely on the non-sensitive session hint.
const ACCESS_COOKIE = "ms_at";
const SESSION_HINT_COOKIE = "ms_session";
const PROTECTED_PREFIXES = ["/meetings", "/history", "/settings"];
const AUTH_PAGES = ["/login", "/register"];

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabase.replace(/^https:/, "wss:");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes come from Motion, Radix and Konva; they cannot carry a nonce.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase}`,
    "media-src 'self' blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseWs}${isDev ? " ws://localhost:*" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(ACCESS_COOKIE) || request.cookies.has(SESSION_HINT_COOKIE);

  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (AUTH_PAGES.includes(pathname) && request.cookies.has(SESSION_HINT_COOKIE)) {
    return NextResponse.redirect(new URL("/meetings", request.url));
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|e2ee-worker.js).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
