import type {
  BoardElement,
  ChatMessage,
  Meeting,
  Participant,
  ParticipantRole,
  ParticipantStatus,
  SharedFile,
  Theme,
  User,
  UserPreferences,
  Whiteboard,
} from "../entities";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: { email: string; passwordHash: string; displayName: string }): Promise<User>;
  update(
    id: string,
    patch: Partial<{
      passwordHash: string;
      displayName: string;
      avatarUrl: string | null;
      theme: Theme;
      preferences: UserPreferences;
      failedLoginCount: number;
      lockedUntil: Date | null;
    }>,
  ): Promise<User>;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
}

export interface RefreshTokenRepository {
  create(data: {
    userId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
  }): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  markReplaced(id: string, replacedBy: string): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export interface RateLimitRepository {
  /** Atomically increments the bucket and returns the current count and reset time. */
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: Date }>;
  reset(key: string): Promise<void>;
}

export interface MeetingRepository {
  create(data: {
    code: string;
    title: string;
    description: string | null;
    hostId: string;
    status: Meeting["status"];
    scheduledFor: Date | null;
    durationMinutes: number;
    allowGuests: boolean;
    waitingRoom: boolean;
    e2eeMedia: boolean;
  }): Promise<Meeting>;
  findByCode(code: string): Promise<Meeting | null>;
  findById(id: string): Promise<Meeting | null>;
  update(id: string, patch: Partial<Omit<Meeting, "id" | "code" | "createdAt">>): Promise<Meeting>;
  listUpcomingForUser(userId: string, now: Date, limit: number): Promise<Meeting[]>;
  listRecentForUser(userId: string, limit: number): Promise<Meeting[]>;
  listHistoryForUser(userId: string, limit: number, cursor?: string): Promise<Meeting[]>;
  delete(id: string): Promise<void>;
}

export interface ParticipantRepository {
  findById(id: string): Promise<Participant | null>;
  findByMeetingAndUser(meetingId: string, userId: string): Promise<Participant | null>;
  listByMeeting(meetingId: string, statuses?: ParticipantStatus[]): Promise<Participant[]>;
  countActive(meetingId: string, since: Date): Promise<number>;
  create(data: {
    meetingId: string;
    userId: string | null;
    displayName: string;
    role: ParticipantRole;
    status: ParticipantStatus;
  }): Promise<Participant>;
  update(
    id: string,
    patch: Partial<Pick<Participant, "status" | "role" | "displayName" | "joinedAt" | "leftAt" | "lastSeenAt">>,
  ): Promise<Participant>;
  markAllLeft(meetingId: string, at: Date): Promise<void>;
}

export interface ChatMessageRepository {
  create(data: Omit<ChatMessage, "createdAt">): Promise<ChatMessage>;
  listByMeeting(meetingId: string, limit: number, before?: Date): Promise<ChatMessage[]>;
}

export interface SharedFileRepository {
  create(data: Omit<SharedFile, "createdAt" | "uploaded">): Promise<SharedFile>;
  findById(id: string): Promise<SharedFile | null>;
  markUploaded(id: string): Promise<SharedFile>;
  listByMeeting(meetingId: string): Promise<SharedFile[]>;
  delete(id: string): Promise<void>;
}

export interface WhiteboardRepository {
  find(meetingId: string): Promise<Whiteboard | null>;
  save(meetingId: string, elements: BoardElement[]): Promise<Whiteboard>;
}
