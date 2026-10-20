import { errors } from "@/core/domain/errors";
import { changePasswordSchema } from "@/lib/schemas/auth";
import { enforceRateLimit, type Deps } from "../context";
import { issueSession } from "./issueSession";

/** Changing the password signs out every other device by revoking all refresh tokens. */
export async function changePassword(
  deps: Pick<Deps, "users" | "hasher" | "tokens" | "refreshTokens" | "rateLimits" | "clock">,
  userId: string,
  input: unknown,
  meta: { userAgent?: string | null } = {},
) {
  await enforceRateLimit(deps, `change-password:${userId}`, 5, 15 * 60_000);
  const data = changePasswordSchema.parse(input);
  const user = await deps.users.findById(userId);
  if (!user) throw errors.unauthenticated();

  if (!(await deps.hasher.verify(user.passwordHash, data.currentPassword))) {
    throw errors.validation("Current password is incorrect.", {
      fieldErrors: { currentPassword: ["Current password is incorrect."] },
    });
  }
  const updated = await deps.users.update(user.id, { passwordHash: await deps.hasher.hash(data.newPassword) });
  await deps.refreshTokens.revokeAllForUser(user.id);
  return issueSession(deps, updated, { userAgent: meta.userAgent });
}
