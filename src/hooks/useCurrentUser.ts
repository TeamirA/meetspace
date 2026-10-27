"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserDto } from "@/core/application/dtos";
import { api, ApiError } from "@/lib/api-client";

export const userQueryKey = ["me"] as const;

/** The signed-in user, or null for visitors. */
export function useCurrentUser() {
  return useQuery({
    queryKey: userQueryKey,
    queryFn: async () => {
      try {
        return (await api<{ user: UserDto | null }>("/api/auth/me")).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useSetCurrentUser() {
  const qc = useQueryClient();
  return (user: UserDto | null) => qc.setQueryData(userQueryKey, user);
}
