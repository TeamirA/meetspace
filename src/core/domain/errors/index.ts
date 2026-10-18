export type DomainErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "TOKEN_EXPIRED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "MEETING_FULL"
  | "MEETING_LOCKED"
  | "MEETING_ENDED"
  | "GUESTS_NOT_ALLOWED"
  | "NOT_CONFIGURED";

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const errors = {
  validation: (message: string, details?: Record<string, unknown>) => new DomainError("VALIDATION", message, details),
  unauthenticated: (message = "Please sign in to continue.") => new DomainError("UNAUTHENTICATED", message),
  tokenExpired: () => new DomainError("TOKEN_EXPIRED", "Your session has expired."),
  invalidCredentials: () => new DomainError("INVALID_CREDENTIALS", "Email or password is incorrect."),
  accountLocked: (until: Date) =>
    new DomainError("ACCOUNT_LOCKED", "Too many failed attempts. Try again later.", {
      lockedUntil: until.toISOString(),
    }),
  rateLimited: (retryAfterSeconds: number) =>
    new DomainError("RATE_LIMITED", "Too many requests. Slow down a little.", { retryAfterSeconds }),
  forbidden: (message = "You don't have permission to do that.") => new DomainError("FORBIDDEN", message),
  notFound: (what = "Resource") => new DomainError("NOT_FOUND", `${what} not found.`),
  conflict: (message: string) => new DomainError("CONFLICT", message),
  meetingFull: (max: number) =>
    new DomainError("MEETING_FULL", `This meeting is full. Up to ${max} people can join.`, { max }),
  meetingLocked: () => new DomainError("MEETING_LOCKED", "The host has locked this meeting."),
  meetingEnded: () => new DomainError("MEETING_ENDED", "This meeting has ended."),
  guestsNotAllowed: () =>
    new DomainError("GUESTS_NOT_ALLOWED", "The host requires attendees to sign in to join this meeting."),
  notConfigured: (what: string) => new DomainError("NOT_CONFIGURED", `${what} is not configured on this server.`),
};

export const isDomainError = (e: unknown): e is DomainError => e instanceof DomainError;
