import type {
  ChatMessageRepository,
  MeetingRepository,
  ParticipantRepository,
  RateLimitRepository,
  RefreshTokenRepository,
  SharedFileRepository,
  UserRepository,
  WhiteboardRepository,
} from "@/core/domain/repositories";
import type { Meeting, Participant } from "@/core/domain/entities";
import { errors } from "@/core/domain/errors";
import type {
  Clock,
  FileStorage,
  PasswordHasher,
  RoomBroadcaster,
  RoomTokenIssuer,
  TokenService,
  TurnCredentialProvider,
} from "./ports";

export interface Deps {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  rateLimits: RateLimitRepository;
  meetings: MeetingRepository;
  participants: ParticipantRepository;
  messages: ChatMessageRepository;
  files: SharedFileRepository;
  whiteboards: WhiteboardRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  roomTokens: RoomTokenIssuer;
  broadcaster: RoomBroadcaster;
  storage: FileStorage;
  turn: TurnCredentialProvider;
  clock: Clock;
}

/** Who is calling: a signed-in user, or a guest holding a meeting-scoped guest token. */
export type Actor =
  | { kind: "user"; userId: string; name: string }
  | { kind: "guest"; participantId: string; meetingId: string; name: string };

export async function enforceRateLimit(
  deps: Pick<Deps, "rateLimits" | "clock">,
  key: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const { count, resetAt } = await deps.rateLimits.hit(key, windowMs);
  if (count > limit) {
    const retry = Math.max(1, Math.ceil((resetAt.getTime() - deps.clock.now().getTime()) / 1000));
    throw errors.rateLimited(retry);
  }
}

export async function requireMeeting(deps: Pick<Deps, "meetings">, code: string): Promise<Meeting> {
  const meeting = await deps.meetings.findByCode(code);
  if (!meeting) throw errors.notFound("Meeting");
  return meeting;
}

export async function findMembership(
  deps: Pick<Deps, "participants">,
  meeting: Meeting,
  actor: Actor,
): Promise<Participant | null> {
  if (actor.kind === "user") return deps.participants.findByMeetingAndUser(meeting.id, actor.userId);
  if (actor.meetingId !== meeting.id) return null;
  return deps.participants.findById(actor.participantId);
}

/** Admitted participants (currently or previously) may use the room and read its content. */
export async function requireAdmitted(
  deps: Pick<Deps, "participants">,
  meeting: Meeting,
  actor: Actor,
): Promise<Participant> {
  const p = await findMembership(deps, meeting, actor);
  if (!p || p.status !== "ADMITTED") throw errors.forbidden("You're not a member of this meeting.");
  return p;
}

export async function requireHost(
  deps: Pick<Deps, "participants">,
  meeting: Meeting,
  actor: Actor,
): Promise<Participant> {
  const p = await requireAdmitted(deps, meeting, actor);
  if (p.role !== "HOST") throw errors.forbidden("Only the host can do that.");
  return p;
}

export function roomTopics(deps: Pick<Deps, "roomTokens">, meeting: Meeting) {
  return deps.roomTokens.topicsFor(meeting.id, meeting.topicEpoch);
}
