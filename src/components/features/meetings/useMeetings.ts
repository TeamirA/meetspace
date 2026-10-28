"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MeetingDto } from "@/core/application/dtos";
import { api } from "@/lib/api-client";
import type { CreateMeetingInput } from "@/lib/schemas/meeting";

export const meetingsKey = (scope: string) => ["meetings", scope] as const;

export function useMeetings(scope: "upcoming" | "recent") {
  return useQuery({
    queryKey: meetingsKey(scope),
    queryFn: () => api<{ items: MeetingDto[] }>(`/api/meetings?scope=${scope}`).then((r) => r.items),
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMeetingInput) =>
      api<{ meeting: MeetingDto }>("/api/meetings", { method: "POST", body: input }).then((r) => r.meeting),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api(`/api/meetings/${code}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}
