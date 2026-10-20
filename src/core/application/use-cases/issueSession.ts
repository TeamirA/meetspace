import type { User } from "@/core/domain/entities";
import { toUserDto, type UserDto } from "../dtos";
import type { Deps } from "../context";

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

/** Starts a new refresh-token family (or continues one during rotation) and signs an access token. */
export async function issueSession(
  deps: Pick<Deps, "tokens" | "refreshTokens" | "clock">,
  user: User,
  opts: { familyId?: string; userAgent?: string | null } = {},
): Promise<SessionTokens & { refreshRecordId: string }> {
  const { token, hash } = deps.tokens.createRefreshToken();
  const record = await deps.refreshTokens.create({
    userId: user.id,
    familyId: opts.familyId ?? crypto.randomUUID(),
    tokenHash: hash,
    expiresAt: new Date(deps.clock.now().getTime() + REFRESH_TTL_SECONDS * 1000),
    userAgent: opts.userAgent?.slice(0, 300) ?? null,
  });
  const accessToken = await deps.tokens.signAccess({ sub: user.id, email: user.email, name: user.displayName });
  return { accessToken, refreshToken: token, user: toUserDto(user), refreshRecordId: record.id };
}
