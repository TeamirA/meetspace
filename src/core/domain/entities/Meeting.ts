export type MeetingStatus = "SCHEDULED" | "LIVE" | "ENDED";

export interface Meeting {
  id: string;
  code: string;
  title: string;
  description: string | null;
  hostId: string;
  status: MeetingStatus;
  scheduledFor: Date | null;
  durationMinutes: number;
  allowGuests: boolean;
  waitingRoom: boolean;
  locked: boolean;
  e2eeMedia: boolean;
  topicEpoch: number;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

export const MAX_PARTICIPANTS = 6;

const ALPHABET = "abcdefghijkmnopqrstuvwxyz"; // no "l" to avoid confusion with "1"/"I"
const CODE_PATTERN = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

/** Generates a Meet-style code such as `abc-defg-hij` (~2^47 combinations). */
export function generateMeetingCode(random: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = random(10);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `${chars.slice(0, 3).join("")}-${chars.slice(3, 7).join("")}-${chars.slice(7, 10).join("")}`;
}

function defaultRandom(n: number): Uint8Array {
  const out = new Uint8Array(n);
  // Rejection sampling keeps the distribution uniform over the 25-letter alphabet.
  let i = 0;
  while (i < n) {
    const buf = crypto.getRandomValues(new Uint8Array(n * 2));
    for (const b of buf) {
      if (b < 250 && i < n) out[i++] = b;
    }
  }
  return out;
}

/** Accepts codes typed loosely (spaces, missing dashes, full links) and normalizes them. */
export function normalizeMeetingCode(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  const fromUrl = trimmed.match(/\/m\/([a-z-]+)/)?.[1] ?? trimmed;
  const letters = fromUrl.replace(/[^a-z]/g, "");
  if (letters.length !== 10) return null;
  const code = `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7)}`;
  return CODE_PATTERN.test(code) ? code : null;
}

export function isValidMeetingCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

export function meetingEndsAt(meeting: Pick<Meeting, "scheduledFor" | "durationMinutes">): Date | null {
  if (!meeting.scheduledFor) return null;
  return new Date(meeting.scheduledFor.getTime() + meeting.durationMinutes * 60_000);
}

export function meetingDurationMs(meeting: Pick<Meeting, "startedAt" | "endedAt">): number | null {
  if (!meeting.startedAt || !meeting.endedAt) return null;
  return Math.max(0, meeting.endedAt.getTime() - meeting.startedAt.getTime());
}
