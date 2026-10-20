import { errors } from "@/core/domain/errors";
import { toUserDto } from "../dtos";
import type { Deps } from "../context";

export async function getCurrentUser(deps: Pick<Deps, "users">, userId: string) {
  const user = await deps.users.findById(userId);
  if (!user) throw errors.unauthenticated();
  return toUserDto(user);
}
