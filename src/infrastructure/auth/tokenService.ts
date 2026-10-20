import { createHash, createHmac, randomBytes } from "node:crypto";
import { errors as joseErrors, jwtVerify, SignJWT } from "jose";
import type { AccessTokenClaims, GuestTokenClaims, TokenService } from "@/core/application/ports";
import { ACCESS_TTL_SECONDS } from "@/core/application/use-cases/issueSession";
import { errors } from "@/core/domain/errors";

const ISSUER = "meetspace";
const GUEST_TTL_SECONDS = 12 * 60 * 60;

export function createTokenService(opts: { accessSecret: string; refreshSecret: string }): TokenService {
  const accessKey = new TextEncoder().encode(opts.accessSecret);

  async function verify<T>(token: string, audience: string): Promise<T> {
    try {
      const { payload } = await jwtVerify(token, accessKey, { issuer: ISSUER, audience, algorithms: ["HS256"] });
      return payload as T;
    } catch (e) {
      if (e instanceof joseErrors.JWTExpired) throw errors.tokenExpired();
      throw errors.unauthenticated();
    }
  }

  return {
    signAccess: (claims) =>
      new SignJWT({ email: claims.email, name: claims.name })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(claims.sub)
        .setIssuer(ISSUER)
        .setAudience("access")
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
        .sign(accessKey),
    async verifyAccess(token) {
      const p = await verify<{ sub: string; email: string; name: string }>(token, "access");
      return { sub: p.sub, email: p.email, name: p.name } satisfies AccessTokenClaims;
    },
    signGuest: (claims) =>
      new SignJWT({ mid: claims.mid, name: claims.name })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(claims.pid)
        .setIssuer(ISSUER)
        .setAudience("guest")
        .setIssuedAt()
        .setExpirationTime(`${GUEST_TTL_SECONDS}s`)
        .sign(accessKey),
    async verifyGuest(token) {
      const p = await verify<{ sub: string; mid: string; name: string }>(token, "guest");
      return { pid: p.sub, mid: p.mid, name: p.name } satisfies GuestTokenClaims;
    },
    createRefreshToken() {
      const token = randomBytes(32).toString("base64url");
      return { token, hash: this.hashRefreshToken(token) };
    },
    // Keyed hash: a leaked database alone is not enough to forge or look up live tokens.
    hashRefreshToken: (token) => createHmac("sha256", opts.refreshSecret).update(token).digest("base64url"),
  };
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("base64url");
