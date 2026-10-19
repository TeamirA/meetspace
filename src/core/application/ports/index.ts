/** Interfaces the application layer needs from infrastructure, beyond persistence. */

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface AccessTokenClaims {
  sub: string;
  email: string;
  name: string;
}

export interface GuestTokenClaims {
  pid: string;
  mid: string;
  name: string;
}

export interface TokenService {
  signAccess(claims: AccessTokenClaims): Promise<string>;
  verifyAccess(token: string): Promise<AccessTokenClaims>;
  signGuest(claims: GuestTokenClaims): Promise<string>;
  verifyGuest(token: string): Promise<GuestTokenClaims>;
  /** Random opaque refresh token and the hash that gets stored. */
  createRefreshToken(): { token: string; hash: string };
  hashRefreshToken(token: string): string;
}

export interface RoomTokenIssuer {
  /** Short-lived Supabase Realtime JWT limited to the room's topics. */
  issue(input: { participantId: string; topic: string; systemTopic: string; ttlSeconds: number }): Promise<string>;
  topicsFor(meetingId: string, epoch: number): { topic: string; systemTopic: string };
}

export type SystemEvent =
  | { type: "waiting-changed" }
  | { type: "admitted"; participantId: string }
  | { type: "denied"; participantId: string }
  | { type: "removed"; participantId: string }
  | { type: "mute"; participantId: string }
  | { type: "host-changed"; participantId: string }
  | { type: "meeting-updated"; locked: boolean }
  | { type: "meeting-ended" };

export interface RoomBroadcaster {
  /** Sends an event on the read-only system topic; only the server can publish there. */
  publish(systemTopic: string, event: SystemEvent): Promise<void>;
}

export interface FileStorage {
  createUploadUrl(path: string): Promise<{ url: string; token: string }>;
  createDownloadUrl(path: string, expiresInSeconds: number): Promise<string>;
  exists(path: string): Promise<{ exists: boolean; size?: number }>;
  remove(paths: string[]): Promise<void>;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface TurnCredentialProvider {
  getIceServers(ttlSeconds: number): Promise<IceServer[]>;
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
