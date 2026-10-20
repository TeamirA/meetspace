import { hash, verify } from "@node-rs/argon2";
import type { PasswordHasher } from "@/core/application/ports";

/**
 * Argon2id with OWASP's recommended baseline (19 MiB memory, 2 iterations, 1 lane).
 * @node-rs/argon2 defaults to the Argon2id variant.
 */
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export const argon2Hasher: PasswordHasher = {
  hash: (password) => hash(password, OPTIONS),
  async verify(passwordHash, password) {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  },
};
