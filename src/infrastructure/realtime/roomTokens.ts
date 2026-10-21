import { createHmac } from "node:crypto";
import { SignJWT } from "jose";
import type { RoomBroadcaster, RoomTokenIssuer, SystemEvent } from "@/core/application/ports";
import { errors } from "@/core/domain/errors";

/**
 * Room topics are derived with an HMAC so they can't be guessed from a meeting id. Access is
 * enforced by RLS on realtime.messages: the JWT below carries the only topics it may use.
 *  - `topic`: peers broadcast signaling, chat and whiteboard events (read + write)
 *  - `systemTopic`: only the server publishes host decisions here (members read only)
 */
export function createRoomTokenIssuer(opts: { topicSecret: string; jwtSecret?: string }): RoomTokenIssuer {
  return {
    topicsFor(meetingId, epoch) {
      const digest = createHmac("sha256", opts.topicSecret).update(`${meetingId}:${epoch}`).digest("base64url");
      const id = digest.slice(0, 32);
      return { topic: `room:${id}`, systemTopic: `room:${id}:system` };
    },
    async issue({ participantId, topic, systemTopic, ttlSeconds }) {
      if (!opts.jwtSecret) throw errors.notConfigured("Realtime authorization (SUPABASE_JWT_SECRET)");
      return new SignJWT({ role: "authenticated", room_topic: topic, system_topic: systemTopic })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(participantId)
        .setAudience("authenticated")
        .setIssuer("meetspace")
        .setIssuedAt()
        .setExpirationTime(`${ttlSeconds}s`)
        .sign(new TextEncoder().encode(opts.jwtSecret));
    },
  };
}

/** Publishes via Supabase's Realtime REST broadcast endpoint using the service role key. */
export function createRoomBroadcaster(opts: { supabaseUrl: string; serviceRoleKey?: string }): RoomBroadcaster {
  return {
    async publish(systemTopic: string, event: SystemEvent) {
      if (!opts.serviceRoleKey) throw errors.notConfigured("Realtime broadcasting (SUPABASE_SERVICE_ROLE_KEY)");
      const res = await fetch(`${opts.supabaseUrl}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: {
          apikey: opts.serviceRoleKey,
          Authorization: `Bearer ${opts.serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ topic: systemTopic, event: "system", payload: event, private: true }],
        }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Realtime broadcast failed: ${res.status} ${await res.text().catch(() => "")}`);
    },
  };
}
