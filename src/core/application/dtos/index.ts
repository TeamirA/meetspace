import type { ChatMessage, Meeting, Participant, SharedFile, User } from "@/core/domain/entities";

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  theme: User["theme"];
  preferences: User["preferences"];
  createdAt: string;
}

export const toUserDto = (u: User): UserDto => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  avatarUrl: u.avatarUrl,
  theme: u.theme,
  preferences: u.preferences,
  createdAt: u.createdAt.toISOString(),
});

export interface MeetingDto {
  id: string;
  code: string;
  title: string;
  description: string | null;
  hostId: string;
  status: Meeting["status"];
  scheduledFor: string | null;
  durationMinutes: number;
  allowGuests: boolean;
  waitingRoom: boolean;
  locked: boolean;
  e2eeMedia: boolean;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export const toMeetingDto = (m: Meeting): MeetingDto => ({
  id: m.id,
  code: m.code,
  title: m.title,
  description: m.description,
  hostId: m.hostId,
  status: m.status,
  scheduledFor: iso(m.scheduledFor),
  durationMinutes: m.durationMinutes,
  allowGuests: m.allowGuests,
  waitingRoom: m.waitingRoom,
  locked: m.locked,
  e2eeMedia: m.e2eeMedia,
  startedAt: iso(m.startedAt),
  endedAt: iso(m.endedAt),
  createdAt: m.createdAt.toISOString(),
});

/** What a not-yet-admitted visitor may learn about a meeting from its link. */
export interface MeetingPreviewDto {
  code: string;
  title: string;
  status: Meeting["status"];
  scheduledFor: string | null;
  allowGuests: boolean;
  locked: boolean;
  e2eeMedia: boolean;
  hostName: string;
  isHost: boolean;
}

export interface ParticipantDto {
  id: string;
  userId: string | null;
  displayName: string;
  role: Participant["role"];
  status: Participant["status"];
  joinedAt: string | null;
  leftAt: string | null;
  createdAt: string;
}

export const toParticipantDto = (p: Participant): ParticipantDto => ({
  id: p.id,
  userId: p.userId,
  displayName: p.displayName,
  role: p.role,
  status: p.status,
  joinedAt: iso(p.joinedAt),
  leftAt: iso(p.leftAt),
  createdAt: p.createdAt.toISOString(),
});

export interface ChatMessageDto {
  id: string;
  participantId: string;
  keyId: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
}

export const toChatMessageDto = (m: ChatMessage): ChatMessageDto => ({
  id: m.id,
  participantId: m.participantId,
  keyId: m.keyId,
  iv: m.iv,
  ciphertext: m.ciphertext,
  createdAt: m.createdAt.toISOString(),
});

export interface SharedFileDto {
  id: string;
  participantId: string;
  keyId: string;
  iv: string;
  encryptedMeta: string;
  metaIv: string;
  sizeBytes: number;
  createdAt: string;
}

export const toSharedFileDto = (f: SharedFile): SharedFileDto => ({
  id: f.id,
  participantId: f.participantId,
  keyId: f.keyId,
  iv: f.iv,
  encryptedMeta: f.encryptedMeta,
  metaIv: f.metaIv,
  sizeBytes: f.sizeBytes,
  createdAt: f.createdAt.toISOString(),
});

export interface RoomSessionDto {
  participant: ParticipantDto;
  meeting: MeetingDto;
  realtime: { token: string; topic: string; systemTopic: string; expiresAt: string };
}
