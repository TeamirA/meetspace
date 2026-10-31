import { describe, expect, it } from "vitest";
import { decideJoin, generateMeetingCode, isValidMeetingCode, normalizeMeetingCode } from "@/core/domain/entities";

describe("meeting codes", () => {
  it("generates codes in the abc-defg-hij format", () => {
    for (let i = 0; i < 200; i++) expect(isValidMeetingCode(generateMeetingCode())).toBe(true);
  });

  it("never uses the ambiguous letter l", () => {
    const codes = Array.from({ length: 500 }, () => generateMeetingCode()).join("");
    expect(codes).not.toContain("l");
  });

  it.each([
    ["abc-defg-hij", "abc-defg-hij"],
    ["ABCDEFGHIJ", "abc-defg-hij"],
    [" abc defg hij ", "abc-defg-hij"],
    ["https://meet.example/m/abc-defg-hij?x=1", "abc-defg-hij"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeMeetingCode(input)).toBe(expected);
  });

  it.each(["", "abc", "abc-defg-hijk", "123-4567-890"])("rejects %s", (input) => {
    expect(normalizeMeetingCode(input)).toBeNull();
  });
});

describe("join policy", () => {
  const meeting = { status: "LIVE" as const, locked: false, waitingRoom: true, allowGuests: true };
  const base = { meeting, isHost: false, isGuest: false, existing: null, activeCount: 1, alreadyActive: false };

  it("lets the host in even when locked and full", () => {
    expect(decideJoin({ ...base, isHost: true, meeting: { ...meeting, locked: true }, activeCount: 6 }).kind).toBe(
      "admit",
    );
  });

  it("sends newcomers to the waiting room", () => {
    expect(decideJoin(base).kind).toBe("wait");
  });

  it("admits directly when the waiting room is off", () => {
    expect(decideJoin({ ...base, meeting: { ...meeting, waitingRoom: false } }).kind).toBe("admit");
  });

  it("enforces the 6 person cap", () => {
    expect(decideJoin({ ...base, activeCount: 6 })).toEqual({ kind: "reject", reason: "FULL" });
  });

  it("lets an already-active participant reconnect when full", () => {
    expect(decideJoin({ ...base, activeCount: 6, alreadyActive: true, existing: { status: "ADMITTED" } }).kind).toBe(
      "admit",
    );
  });

  it("blocks new people when locked but lets admitted members back", () => {
    const locked = { ...meeting, locked: true };
    expect(decideJoin({ ...base, meeting: locked })).toEqual({ kind: "reject", reason: "LOCKED" });
    expect(decideJoin({ ...base, meeting: locked, existing: { status: "ADMITTED" } }).kind).toBe("admit");
  });

  it("rejects guests when the host requires sign-in", () => {
    expect(decideJoin({ ...base, isGuest: true, meeting: { ...meeting, allowGuests: false } })).toEqual({
      kind: "reject",
      reason: "GUESTS_NOT_ALLOWED",
    });
  });

  it("keeps removed people out", () => {
    expect(decideJoin({ ...base, existing: { status: "REMOVED" } })).toEqual({ kind: "reject", reason: "REMOVED" });
  });

  it("rejects joins to ended meetings", () => {
    expect(decideJoin({ ...base, meeting: { ...meeting, status: "ENDED" } })).toEqual({
      kind: "reject",
      reason: "ENDED",
    });
  });
});
