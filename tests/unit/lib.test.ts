import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText } from "@/lib/ics";
import { sanitizeChatText, sanitizeDisplayName, tokenizeChatText } from "@/lib/sanitize";
import { registerSchema } from "@/lib/schemas/auth";
import { boardElementSchema, chatMessageSchema, createFileSchema } from "@/lib/schemas/content";
import { createMeetingSchema } from "@/lib/schemas/meeting";
import { classifyQuality } from "@/media/ConnectionStatsMonitor";
import { formatBytes, formatDuration, initials } from "@/lib/utils";

describe("chat sanitizing", () => {
  it("strips control and bidi override characters", () => {
    expect(sanitizeChatText("hi\u0000 there‮!")).toBe("hi there!");
  });

  it("only turns http(s) URLs into links", () => {
    const tokens = tokenizeChatText("see https://example.com/a?b=1. and javascript:alert(1)");
    expect(tokens.filter((t) => t.kind === "link").map((t) => t.value)).toEqual(["https://example.com/a?b=1"]);
    expect(tokens.map((t) => t.value).join("")).toBe("see https://example.com/a?b=1. and javascript:alert(1)");
  });

  it("keeps markup as inert text", () => {
    const tokens = tokenizeChatText("<img src=x onerror=alert(1)>");
    expect(tokens).toEqual([{ kind: "text", value: "<img src=x onerror=alert(1)>" }]);
  });

  it("cleans display names", () => {
    expect(sanitizeDisplayName("<b>Ann</b>")).toBe("bAnn/b");
    expect(sanitizeDisplayName(42)).toBe("Guest");
  });
});

describe("schemas", () => {
  it("requires strong-enough passwords", () => {
    expect(registerSchema.safeParse({ email: "a@b.co", password: "short1", displayName: "A" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.co", password: "onlyletterslong", displayName: "A" }).success).toBe(
      false,
    );
    expect(registerSchema.safeParse({ email: "A@B.co", password: "letters-and-1", displayName: "A" }).data?.email).toBe(
      "a@b.co",
    );
  });

  it("rejects files over 50 MB", () => {
    const base = {
      id: crypto.randomUUID(),
      keyId: "abcdefgh12",
      iv: "AAAAAAAAAAAAAAAA",
      encryptedMeta: "AAAA",
      metaIv: "AAAAAAAAAAAAAAAA",
    };
    expect(createFileSchema.safeParse({ ...base, sizeBytes: 50 * 1024 * 1024 + 16 }).success).toBe(true);
    expect(createFileSchema.safeParse({ ...base, sizeBytes: 50 * 1024 * 1024 + 17 }).success).toBe(false);
  });

  it("accepts only base64 chat ciphertext", () => {
    const ok = { id: crypto.randomUUID(), keyId: "abcdefgh12", iv: "AAAAAAAAAAAAAAAA", ciphertext: "SGVsbG8=" };
    expect(chatMessageSchema.safeParse(ok).success).toBe(true);
    expect(chatMessageSchema.safeParse({ ...ok, ciphertext: "<script>" }).success).toBe(false);
  });

  it("validates whiteboard elements", () => {
    const el = {
      id: "1",
      authorId: "a",
      color: "#112233",
      size: 4,
      clock: 1,
      type: "rect",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    };
    expect(boardElementSchema.safeParse(el).success).toBe(true);
    expect(boardElementSchema.safeParse({ ...el, color: "red" }).success).toBe(false);
    expect(boardElementSchema.safeParse({ ...el, type: "script" }).success).toBe(false);
  });

  it("rejects meetings scheduled in the past", () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    expect(createMeetingSchema.safeParse({ title: "x", scheduledFor: past }).success).toBe(false);
  });
});

describe("calendar export", () => {
  it("builds a valid single-event calendar", () => {
    const ics = buildIcs({
      uid: "1@meetspace",
      title: "Sync, weekly; team",
      start: new Date("2026-11-02T15:00:00Z"),
      durationMinutes: 45,
      url: "https://app.test/m/abc-defg-hij",
      now: new Date("2026-10-31T00:00:00Z"),
    });
    expect(ics).toContain("DTSTART:20261102T150000Z");
    expect(ics).toContain("DTEND:20261102T154500Z");
    expect(ics).toContain("SUMMARY:Sync\\, weekly\\; team");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
    expect(escapeIcsText("a\nb")).toBe("a\\nb");
  });
});

describe("helpers", () => {
  it("formats sizes and durations", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(50 * 1024 * 1024)).toBe("50 MB");
    expect(formatDuration(95 * 60_000)).toBe("1 h 35 min");
    expect(initials("ada king lovelace")).toBe("AL");
  });

  it("classifies connection quality", () => {
    expect(classifyQuality(80, 0)).toBe("good");
    expect(classifyQuality(320, 3)).toBe("fair");
    expect(classifyQuality(900, 20)).toBe("poor");
    expect(classifyQuality(null, null)).toBe("unknown");
  });
});
