import { errors } from "@/core/domain/errors";
import { updateProfileSchema } from "@/lib/schemas/auth";
import { toUserDto } from "../dtos";
import type { Deps } from "../context";

export async function updateProfile(deps: Pick<Deps, "users">, userId: string, input: unknown) {
  const data = updateProfileSchema.parse(input);
  const user = await deps.users.findById(userId);
  if (!user) throw errors.unauthenticated();
  const updated = await deps.users.update(userId, {
    ...(data.displayName !== undefined && { displayName: data.displayName }),
    ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
    ...(data.theme !== undefined && { theme: data.theme }),
    ...(data.preferences !== undefined && { preferences: { ...user.preferences, ...data.preferences } }),
  });
  return toUserDto(updated);
}
