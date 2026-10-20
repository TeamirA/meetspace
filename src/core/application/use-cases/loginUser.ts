import { isLocked, normalizeEmail, registerFailedLogin } from "@/core/domain/entities";
import { errors } from "@/core/domain/errors";
import { loginSchema } from "@/lib/schemas/auth";
import { enforceRateLimit, type Deps } from "../context";
import { issueSession } from "./issueSession";

// Verifying against a real hash keeps response time similar for unknown emails.
let dummyHash: Promise<string> | undefined;

export async function loginUser(
  deps: Pick<Deps, "users" | "hasher" | "tokens" | "refreshTokens" | "rateLimits" | "clock">,
  input: unknown,
  meta: { ip: string; userAgent?: string | null },
) {
  const data = loginSchema.parse(input);
  const email = normalizeEmail(data.email);
  await enforceRateLimit(deps, `login:ip:${meta.ip}`, 30, 15 * 60_000);
  await enforceRateLimit(deps, `login:email:${email}`, 10, 15 * 60_000);

  const user = await deps.users.findByEmail(email);
  if (!user) {
    dummyHash ??= deps.hasher.hash("timing-equalizer-not-a-real-password");
    await deps.hasher.verify(await dummyHash, data.password).catch(() => false);
    throw errors.invalidCredentials();
  }
  const now = deps.clock.now();
  if (isLocked(user, now)) throw errors.accountLocked(user.lockedUntil!);

  const ok = await deps.hasher.verify(user.passwordHash, data.password);
  if (!ok) {
    const next = registerFailedLogin(user, now);
    await deps.users.update(user.id, next);
    if (next.lockedUntil) throw errors.accountLocked(next.lockedUntil);
    throw errors.invalidCredentials();
  }

  const fresh =
    user.failedLoginCount > 0 || user.lockedUntil
      ? await deps.users.update(user.id, { failedLoginCount: 0, lockedUntil: null })
      : user;
  return issueSession(deps, fresh, { userAgent: meta.userAgent });
}
