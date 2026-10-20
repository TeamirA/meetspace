import { normalizeEmail } from "@/core/domain/entities";
import { errors } from "@/core/domain/errors";
import { registerSchema } from "@/lib/schemas/auth";
import { enforceRateLimit, type Deps } from "../context";
import { issueSession } from "./issueSession";

export async function registerUser(
  deps: Pick<Deps, "users" | "hasher" | "tokens" | "refreshTokens" | "rateLimits" | "clock">,
  input: unknown,
  meta: { ip: string; userAgent?: string | null },
) {
  await enforceRateLimit(deps, `register:ip:${meta.ip}`, 10, 60 * 60_000);
  const data = registerSchema.parse(input);
  const email = normalizeEmail(data.email);

  if (await deps.users.findByEmail(email)) {
    throw errors.conflict("An account with this email already exists.");
  }
  const passwordHash = await deps.hasher.hash(data.password);
  const user = await deps.users.create({ email, passwordHash, displayName: data.displayName });
  return issueSession(deps, user, { userAgent: meta.userAgent });
}
