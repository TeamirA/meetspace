import type { Meeting } from "./Meeting";
import { MAX_PARTICIPANTS } from "./Meeting";

export type ParticipantRole = "HOST" | "PARTICIPANT" | "GUEST";
export type ParticipantStatus = "WAITING" | "ADMITTED" | "DENIED" | "REMOVED" | "LEFT";

export interface Participant {
  id: string;
  meetingId: string;
  userId: string | null;
  displayName: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  joinedAt: Date | null;
  leftAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
}

/** A participant counts toward the cap while admitted and seen within this window. */
export const PRESENCE_TIMEOUT_MS = 70_000;

export function isActive(p: Pick<Participant, "status" | "lastSeenAt">, now = new Date()): boolean {
  return (
    p.status === "ADMITTED" && p.lastSeenAt !== null && now.getTime() - p.lastSeenAt.getTime() < PRESENCE_TIMEOUT_MS
  );
}

export type JoinDecision =
  | { kind: "admit" }
  | { kind: "wait" }
  | { kind: "reject"; reason: "LOCKED" | "FULL" | "ENDED" | "GUESTS_NOT_ALLOWED" | "REMOVED" };

/**
 * Pure join policy shared by the use case and its tests.
 * Hosts always get in (and restart ended meetings); everyone else respects lock, cap and waiting room.
 */
export function decideJoin(input: {
  meeting: Pick<Meeting, "status" | "locked" | "waitingRoom" | "allowGuests">;
  isHost: boolean;
  isGuest: boolean;
  existing: Pick<Participant, "status"> | null;
  activeCount: number;
  alreadyActive: boolean;
}): JoinDecision {
  const { meeting, isHost, isGuest, existing, activeCount, alreadyActive } = input;
  if (isHost) return { kind: "admit" };
  if (isGuest && !meeting.allowGuests) return { kind: "reject", reason: "GUESTS_NOT_ALLOWED" };
  if (meeting.status === "ENDED") return { kind: "reject", reason: "ENDED" };
  if (existing?.status === "REMOVED") return { kind: "reject", reason: "REMOVED" };
  if (meeting.locked && existing?.status !== "ADMITTED") return { kind: "reject", reason: "LOCKED" };
  if (!alreadyActive && activeCount >= MAX_PARTICIPANTS) return { kind: "reject", reason: "FULL" };
  if (existing?.status === "ADMITTED") return { kind: "admit" };
  if (meeting.waitingRoom) return { kind: "wait" };
  return { kind: "admit" };
}
