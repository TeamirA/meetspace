import type { Deps } from "../context";

export async function logoutUser(deps: Pick<Deps, "tokens" | "refreshTokens">, refreshToken: string | undefined) {
  if (!refreshToken) return;
  const record = await deps.refreshTokens.findByHash(deps.tokens.hashRefreshToken(refreshToken));
  if (record) await deps.refreshTokens.revokeFamily(record.familyId);
}
