import { errors } from "@/core/domain/errors";
import type { Deps } from "../context";
import { issueSession } from "./issueSession";

/**
 * Two tabs may refresh at the same moment with the same token. Within this window a
 * just-rotated token is treated as a benign race instead of a stolen-token replay.
 */
export const ROTATION_GRACE_MS = 20_000;

export async function refreshSession(
  deps: Pick<Deps, "users" | "tokens" | "refreshTokens" | "clock">,
  refreshToken: string | undefined,
  meta: { userAgent?: string | null } = {},
) {
  if (!refreshToken) throw errors.unauthenticated();
  const record = await deps.refreshTokens.findByHash(deps.tokens.hashRefreshToken(refreshToken));
  if (!record) throw errors.unauthenticated();

  const now = deps.clock.now();
  if (record.revokedAt) {
    const benignRace = record.replacedBy !== null && now.getTime() - record.revokedAt.getTime() < ROTATION_GRACE_MS;
    if (!benignRace) {
      // Reuse of a rotated or revoked token: assume theft and kill every token in the family.
      await deps.refreshTokens.revokeFamily(record.familyId);
      throw errors.unauthenticated("Your session was signed out for security. Please sign in again.");
    }
  }
  if (record.expiresAt.getTime() <= now.getTime()) throw errors.unauthenticated();

  const user = await deps.users.findById(record.userId);
  if (!user) throw errors.unauthenticated();

  const session = await issueSession(deps, user, { familyId: record.familyId, userAgent: meta.userAgent });
  if (!record.revokedAt) await deps.refreshTokens.markReplaced(record.id, session.refreshRecordId);
  return session;
}
