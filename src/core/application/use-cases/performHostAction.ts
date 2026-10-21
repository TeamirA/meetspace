import { errors } from "@/core/domain/errors";
import { hostActionSchema } from "@/lib/schemas/meeting";
import { requireHost, requireMeeting, roomTopics, type Actor, type Deps } from "../context";

/**
 * Host controls: waiting room decisions, mute/remove, host transfer and ending the meeting.
 * State changes are persisted first, then announced on the server-only system topic so clients
 * can trust that these commands really came from the host.
 */
export async function performHostAction(
  deps: Pick<Deps, "meetings" | "participants" | "broadcaster" | "roomTokens" | "clock">,
  code: string,
  actor: Actor,
  input: unknown,
) {
  const action = hostActionSchema.parse(input);
  const meeting = await requireMeeting(deps, code);
  const host = await requireHost(deps, meeting, actor);
  const { systemTopic } = roomTopics(deps, meeting);
  // Decisions are already persisted; clients also poll, so a failed announcement isn't fatal.
  const publish = (event: Parameters<Deps["broadcaster"]["publish"]>[1]) =>
    deps.broadcaster.publish(systemTopic, event).catch((e) => console.warn("[host-action] broadcast failed", e));

  const target = async (id: string) => {
    const p = await deps.participants.findById(id);
    if (!p || p.meetingId !== meeting.id) throw errors.notFound("Participant");
    if (p.id === host.id) throw errors.validation("You can't do that to yourself.");
    return p;
  };

  switch (action.action) {
    case "admit": {
      const p = await target(action.participantId);
      await deps.participants.update(p.id, { status: "ADMITTED" });
      await publish({ type: "admitted", participantId: p.id });
      break;
    }
    case "admit-all": {
      const waiting = await deps.participants.listByMeeting(meeting.id, ["WAITING"]);
      for (const p of waiting) {
        await deps.participants.update(p.id, { status: "ADMITTED" });
        await publish({ type: "admitted", participantId: p.id });
      }
      break;
    }
    case "deny": {
      const p = await target(action.participantId);
      await deps.participants.update(p.id, { status: "DENIED" });
      await publish({ type: "denied", participantId: p.id });
      break;
    }
    case "remove": {
      const p = await target(action.participantId);
      await deps.participants.update(p.id, { status: "REMOVED", leftAt: deps.clock.now(), lastSeenAt: null });
      await publish({ type: "removed", participantId: p.id });
      break;
    }
    case "mute": {
      const p = await target(action.participantId);
      await publish({ type: "mute", participantId: p.id });
      break;
    }
    case "transfer-host": {
      const p = await target(action.participantId);
      if (p.status !== "ADMITTED" || !p.userId) {
        throw errors.validation("Host can only be transferred to a signed-in participant in the call.");
      }
      await deps.participants.update(p.id, { role: "HOST" });
      await deps.participants.update(host.id, { role: "PARTICIPANT" });
      await deps.meetings.update(meeting.id, { hostId: p.userId });
      await publish({ type: "host-changed", participantId: p.id });
      break;
    }
    case "end": {
      const now = deps.clock.now();
      await deps.meetings.update(meeting.id, { status: "ENDED", endedAt: now });
      await deps.participants.markAllLeft(meeting.id, now);
      await publish({ type: "meeting-ended" });
      break;
    }
  }
  if (action.action !== "end" && action.action !== "mute") await publish({ type: "waiting-changed" });
  return { ok: true as const };
}
