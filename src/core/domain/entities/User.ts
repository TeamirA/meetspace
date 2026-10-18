export type Theme = "SYSTEM" | "DARK" | "LIGHT";

export interface UserPreferences {
  cameraId?: string;
  microphoneId?: string;
  speakerId?: string;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string | null;
  theme: Theme;
  preferences: UserPreferences;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
}

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export function isLocked(user: Pick<User, "lockedUntil">, now = new Date()): boolean {
  return user.lockedUntil !== null && user.lockedUntil.getTime() > now.getTime();
}

/** Returns the new failure counter and, once the threshold is reached, the lockout expiry. */
export function registerFailedLogin(
  user: Pick<User, "failedLoginCount">,
  now = new Date(),
): { failedLoginCount: number; lockedUntil: Date | null } {
  const failedLoginCount = user.failedLoginCount + 1;
  if (failedLoginCount >= MAX_FAILED_LOGINS) {
    return { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) };
  }
  return { failedLoginCount, lockedUntil: null };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
