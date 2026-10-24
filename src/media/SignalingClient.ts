import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { SystemEvent } from "@/core/application/ports";

/** What each participant publishes about itself through Realtime presence. */
export interface PresenceInfo {
  participantId: string;
  /** Random per page load, so a refreshed tab is recognized as a new peer connection. */
  sessionId: string;
  displayName: string;
  role: "HOST" | "PARTICIPANT" | "GUEST";
  joinedAt: number;
  mic: boolean;
  cam: boolean;
  cameraStreamId: string;
  screenStreamId: string | null;
  handRaisedAt: number | null;
  ecdhPublicKey: string;
  keyId: string | null;
  keyEpoch: number | null;
}

export interface Envelope<T = unknown> {
  from: string;
  fromSession: string;
  to: string | null;
  toSession?: string;
  type: string;
  payload: T;
}

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "closed";

interface Options {
  supabaseUrl: string;
  anonKey: string;
  topic: string;
  systemTopic: string;
  selfId: string;
  sessionId: string;
  getToken: () => string;
}

/**
 * Thin wrapper over two private Supabase Realtime channels:
 *  - the room topic: presence + addressed broadcast envelopes (WebRTC signaling, chat, board)
 *  - the system topic: read-only server announcements (host decisions)
 * Messages are addressed to a participant + session; everything else is filtered out locally.
 */
export class SignalingClient {
  private client: SupabaseClient;
  private room?: RealtimeChannel;
  private system?: RealtimeChannel;
  private presence?: PresenceInfo;
  private handlers = {
    message: new Set<(e: Envelope) => void>(),
    presence: new Set<(list: PresenceInfo[]) => void>(),
    system: new Set<(e: SystemEvent) => void>(),
    status: new Set<(s: ConnectionStatus) => void>(),
  };
  status: ConnectionStatus = "connecting";

  constructor(private readonly opts: Options) {
    this.client = createClient(opts.supabaseUrl, opts.anonKey, {
      accessToken: async () => opts.getToken(),
      realtime: { params: { eventsPerSecond: 40 }, heartbeatIntervalMs: 15_000 },
    });
  }

  on<K extends keyof SignalingClient["handlers"]>(
    event: K,
    fn: SignalingClient["handlers"][K] extends Set<infer F> ? F : never,
  ) {
    (this.handlers[event] as Set<typeof fn>).add(fn);
    return () => {
      (this.handlers[event] as Set<typeof fn>).delete(fn);
    };
  }

  private setStatus(s: ConnectionStatus) {
    if (this.status === s) return;
    this.status = s;
    for (const fn of this.handlers.status) fn(s);
  }

  async connect(presence: PresenceInfo): Promise<void> {
    this.presence = presence;
    await this.client.realtime.setAuth(this.opts.getToken());

    this.system = this.client
      .channel(this.opts.systemTopic, { config: { private: true } })
      .on("broadcast", { event: "system" }, ({ payload }) => {
        for (const fn of this.handlers.system) fn(payload as SystemEvent);
      });
    this.system.subscribe();

    const room = this.client.channel(this.opts.topic, {
      config: {
        private: true,
        broadcast: { self: false, ack: false },
        presence: { key: `${presence.participantId}:${presence.sessionId}`, enabled: true },
      },
    });
    this.room = room;

    room
      .on("broadcast", { event: "msg" }, ({ payload }) => {
        const env = payload as Envelope;
        if (env.from === this.opts.selfId && env.fromSession === this.opts.sessionId) return;
        if (env.to && env.to !== this.opts.selfId) return;
        if (env.toSession && env.toSession !== this.opts.sessionId) return;
        for (const fn of this.handlers.message) fn(env);
      })
      .on("presence", { event: "sync" }, () => this.emitPresence());

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      room.subscribe(async (status, err) => {
        if (status === "SUBSCRIBED") {
          await room.track(this.presence!);
          this.setStatus("connected");
          if (!settled) {
            settled = true;
            resolve();
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          this.setStatus("reconnecting");
          if (!settled) {
            settled = true;
            reject(err ?? new Error(`Realtime ${status.toLowerCase()}`));
          }
        } else if (status === "CLOSED") {
          this.setStatus(this.status === "closed" ? "closed" : "reconnecting");
        }
      });
    });
  }

  private emitPresence() {
    if (!this.room) return;
    const state = this.room.presenceState<PresenceInfo>();
    const list: PresenceInfo[] = [];
    for (const entries of Object.values(state)) {
      // A key can briefly hold duplicates during reconnects; the latest entry wins.
      const latest = entries[entries.length - 1];
      if (latest && latest.participantId) list.push(latest as unknown as PresenceInfo);
    }
    for (const fn of this.handlers.presence) fn(list);
  }

  async updatePresence(patch: Partial<PresenceInfo>) {
    if (!this.presence) return;
    this.presence = { ...this.presence, ...patch };
    if (this.status === "connected") await this.room?.track(this.presence).catch(() => undefined);
  }

  send<T>(to: string | null, type: string, payload: T, toSession?: string) {
    if (!this.room) return;
    const envelope: Envelope<T> = {
      from: this.opts.selfId,
      fromSession: this.opts.sessionId,
      to,
      toSession,
      type,
      payload,
    };
    void this.room.send({ type: "broadcast", event: "msg", payload: envelope }).catch(() => undefined);
  }

  /** Force the socket to pick up a freshly issued token right away. */
  async refreshAuth() {
    await this.client.realtime.setAuth(this.opts.getToken()).catch(() => undefined);
  }

  async disconnect() {
    this.setStatus("closed");
    await this.room?.untrack().catch(() => undefined);
    await this.client.removeAllChannels().catch(() => undefined);
    this.client.realtime.disconnect();
  }
}
