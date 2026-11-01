import type {
  ChatMessageDto,
  MeetingDto,
  ParticipantDto,
  RoomSessionDto,
  SharedFileDto,
} from "@/core/application/dtos";
import type { IceServer, SystemEvent } from "@/core/application/ports";
import type { ChatPlaintext } from "@/core/domain/entities/ChatMessage";
import { MAX_FILE_BYTES, type FileMeta } from "@/core/domain/entities/SharedFile";
import type { BoardElement } from "@/core/domain/entities/Whiteboard";
import { MeetingKeyring, type KeyOffer } from "@/crypto/MeetingKeyring";
import { indexedDbKeyStore } from "@/crypto/keyStore";
import { api, ApiError, uploadWithProgress } from "@/lib/api-client";
import { sanitizeChatText, sanitizeDisplayName } from "@/lib/sanitize";
import { callStore, type RemoteParticipant } from "@/stores/callStore";
import type { WhiteboardMessage } from "@/whiteboard/sync";
import { WhiteboardSync } from "@/whiteboard/sync";
import { ActiveSpeakerDetector } from "./ActiveSpeakerDetector";
import { ConnectionStatsMonitor } from "./ConnectionStatsMonitor";
import { LiveCaptions } from "./LiveCaptions";
import { LocalMediaController } from "./LocalMediaController";
import { LocalRecorder } from "./LocalRecorder";
import { MediaE2EE } from "./MediaE2EE";
import { PeerConnectionManager, type SignalMessage } from "./PeerConnectionManager";
import { ScreenShareController } from "./ScreenShareController";
import { SignalingClient, type Envelope, type PresenceInfo } from "./SignalingClient";

export const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "😮", "🙌", "🤔"] as const;

export interface Notice {
  kind: "info" | "success" | "warning" | "error";
  title: string;
  description?: string;
  /** Lets toasts for the same subject replace each other. */
  id?: string;
}

const HEARTBEAT_MS = 25_000;
const TOKEN_REFRESH_MS = 7 * 60_000;
const LEAVE_GRACE_MS = 6_000;

/**
 * Orchestrates one participant's membership in a call: signaling, the WebRTC mesh, E2EE keys,
 * chat, files, reactions, captions and the whiteboard. Framework-agnostic; it publishes state
 * into the call store and React only renders it.
 */
export class CallSession {
  readonly sessionId = crypto.randomUUID();
  readonly selfId: string;
  readonly whiteboard: WhiteboardSync;
  private signaling: SignalingClient;
  private peers: PeerConnectionManager;
  private keyring: MeetingKeyring;
  private detector: ActiveSpeakerDetector;
  private stats: ConnectionStatsMonitor;
  private screen: ScreenShareController;
  private captions: LiveCaptions;
  private recorder = new LocalRecorder();
  private e2ee?: MediaE2EE;
  private token: string;
  private remoteStreams = new Map<string, Map<string, MediaStream>>();
  private presence = new Map<string, PresenceInfo>();
  private leaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private lockedMessages = new Map<string, ChatMessageDto>();
  private fileDtos = new Map<string, SharedFileDto>();
  private initialSyncDone = false;
  private keyBootstrapTimer?: ReturnType<typeof setTimeout>;
  private unsubscribers: (() => void)[] = [];
  private ended = false;
  /** Set while this host is ending the meeting, so the broadcast echo shows the right message. */
  private endingForEveryone = false;
  readonly joinedAt = Date.now();
  levels = new Map<string, number>();

  private constructor(
    readonly code: string,
    private meeting: MeetingDto,
    private self: ParticipantDto,
    realtime: RoomSessionDto["realtime"],
    iceServers: IceServer[],
    readonly media: LocalMediaController,
    private readonly notify: (n: Notice) => void,
  ) {
    this.selfId = self.id;
    this.token = realtime.token;

    this.signaling = new SignalingClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      topic: realtime.topic,
      systemTopic: realtime.systemTopic,
      selfId: self.id,
      sessionId: this.sessionId,
      getToken: () => this.token,
    });

    if (meeting.e2eeMedia) this.e2ee = new MediaE2EE();

    this.peers = new PeerConnectionManager(
      self.id,
      iceServers as RTCIceServer[],
      () => ({
        stream: this.media.stream,
        audio: this.media.audioTrack,
        video: this.media.videoTrack,
        screen: this.screen.stream,
      }),
      {
        signal: (to, toSession, msg) => this.signaling.send(to, "signal", msg, toSession),
        onTrack: (peerId, track, stream) => this.onRemoteTrack(peerId, track, stream),
        onConnectionState: (peerId, state) => {
          callStore.patchParticipant(peerId, { connection: state });
        },
        onData: (peerId, data) => {
          const d = data as { type?: string; msg?: WhiteboardMessage };
          if (d?.type === "wb" && d.msg?.type === "wb:preview") this.whiteboard.handle(peerId, d.msg);
        },
      },
      this.e2ee,
    );

    this.keyring = new MeetingKeyring(meeting.id, self.id, indexedDbKeyStore, (to, offer) =>
      this.signaling.send(to, "key-offer", offer, this.presence.get(to)?.sessionId),
    );

    this.whiteboard = new WhiteboardSync(
      self.id,
      {
        broadcast: (msg) => this.signaling.send(null, "wb", msg),
        sendFast: (msg) => {
          this.peers.sendData({ type: "wb", msg });
        },
        sendTo: (peerId, msg) => this.sendWhiteboardTo(peerId, msg),
      },
      (elements) =>
        api(`/api/meetings/${code}/whiteboard`, { method: "PUT", body: { elements } }).then(() => undefined),
      () => this.isLeader(),
    );

    this.detector = new ActiveSpeakerDetector(
      (id) => callStore.set({ activeSpeakerId: id }),
      (levels) => (this.levels = levels),
    );
    this.stats = new ConnectionStatsMonitor(
      () => this.peers.connections,
      (peerId, s) => {
        if (callStore.get().participants[peerId]?.quality !== s.quality) {
          callStore.patchParticipant(peerId, { quality: s.quality });
        }
      },
    );
    this.screen = new ScreenShareController(() => this.onScreenShareEnded());
    this.captions = new LiveCaptions((text, final) => this.onLocalCaption(text, final));
  }

  /** Fetches room credentials and ICE servers, then connects. */
  static async join(code: string, media: LocalMediaController, notify: (n: Notice) => void) {
    // Both only require admitted membership, so fetch them in parallel.
    const [session, turn] = await Promise.all([
      api<RoomSessionDto>(`/api/meetings/${code}/session`, { method: "POST" }),
      api<{ iceServers: IceServer[] }>(`/api/meetings/${code}/turn`).catch(() => ({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }] as IceServer[],
      })),
    ]);
    const call = new CallSession(
      code,
      session.meeting,
      session.participant,
      session.realtime,
      turn.iceServers,
      media,
      notify,
    );
    await call.start();
    return call;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  private async start() {
    callStore.reset();
    callStore.set({
      phase: "connecting",
      meeting: this.meeting,
      locked: this.meeting.locked,
      self: {
        id: this.self.id,
        sessionId: this.sessionId,
        displayName: this.self.displayName,
        role: this.self.role,
        joinedAt: this.joinedAt,
      },
      local: {
        mic: this.media.micEnabled && !!this.media.audioTrack,
        cam: this.media.camEnabled && !!this.media.videoTrack,
        screen: false,
        handRaisedAt: null,
        recording: false,
        captions: false,
        videoTrackId: this.media.videoTrack?.id ?? null,
      },
      security: { ready: false, fingerprint: null, mediaE2EE: !!this.e2ee },
    });

    await this.keyring.init();
    this.unsubscribers.push(
      this.keyring.subscribe((s) => void this.onKeyChanged(s.fingerprint)),
      this.media.subscribe(() => void this.onLocalMediaChanged()),
      this.signaling.on("message", (e) => void this.onMessage(e)),
      this.signaling.on("presence", (list) => this.onPresence(list)),
      this.signaling.on("system", (e) => void this.onSystem(e)),
      this.signaling.on("status", (status) => {
        callStore.set({ signaling: status });
        if (status === "connected" && callStore.get().phase === "connected") this.peers.restartIceAll();
      }),
    );
    if (this.keyring.state.ready) await this.onKeyChanged(this.keyring.state.fingerprint);

    await this.signaling.connect(this.presenceInfo());
    callStore.set({ phase: "connected", signaling: "connected" });
    this.detector.track(this.selfId, this.media.stream);
    this.stats.start();

    this.timers.push(
      setInterval(() => void this.heartbeat(), HEARTBEAT_MS),
      setInterval(() => void this.refreshToken(), TOKEN_REFRESH_MS),
    );
    window.addEventListener("online", this.onOnline);
    window.addEventListener("offline", this.onOffline);
    window.addEventListener("pagehide", this.onPageHide);

    // Bootstrap content in parallel; each piece degrades on its own.
    void this.refreshParticipants();
    void this.loadChatHistory();
    void this.loadFiles();
    void this.loadWhiteboard();
    this.scheduleKeyBootstrap();
  }

  private presenceInfo(): PresenceInfo {
    const s = callStore.get();
    return {
      participantId: this.selfId,
      sessionId: this.sessionId,
      displayName: this.self.displayName,
      role: this.self.role,
      joinedAt: this.joinedAt,
      mic: s.local.mic,
      cam: s.local.cam,
      cameraStreamId: this.media.stream.id,
      screenStreamId: this.screen.stream?.id ?? null,
      handRaisedAt: s.local.handRaisedAt,
      ecdhPublicKey: this.keyring.publicKey,
      keyId: this.keyring.state.keyId,
      keyEpoch: this.keyring.currentKey?.epoch ?? null,
    };
  }

  private publishPresence() {
    void this.signaling.updatePresence(this.presenceInfo());
  }

  private onOnline = () => {
    callStore.set({ online: true });
    this.peers.restartIceAll();
    void this.refreshToken();
  };

  private onOffline = () => callStore.set({ online: false });

  private onPageHide = () => {
    navigator.sendBeacon?.(`/api/meetings/${this.code}/leave`);
  };

  private async heartbeat() {
    try {
      await api(`/api/meetings/${this.code}/heartbeat`, { method: "POST" });
    } catch (e) {
      this.handleMembershipError(e);
    }
  }

  private async refreshToken() {
    try {
      const s = await api<RoomSessionDto>(`/api/meetings/${this.code}/session`, { method: "POST" });
      this.token = s.realtime.token;
      await this.signaling.refreshAuth();
    } catch (e) {
      this.handleMembershipError(e);
    }
  }

  private handleMembershipError(e: unknown) {
    if (!(e instanceof ApiError)) return;
    if (e.code === "MEETING_ENDED") void this.end("ended");
    else if (e.status === 403) void this.end("removed");
  }

  /** Leave the call. `reason` decides the end screen. */
  async end(reason: "left" | "ended" | "ended-by-you" | "removed" | "duplicate" = "left") {
    if (this.ended) return;
    this.ended = true;
    await this.whiteboard.flush().catch(() => undefined);
    if (reason === "left" || reason === "duplicate") {
      await api(`/api/meetings/${this.code}/leave`, { method: "POST" }).catch(() =>
        navigator.sendBeacon?.(`/api/meetings/${this.code}/leave`),
      );
    }
    this.dispose();
    const messages = {
      left: "You left the meeting",
      ended: "The host ended the meeting",
      "ended-by-you": "You ended the meeting for everyone",
      removed: "You were removed from the meeting",
      duplicate: "You joined this meeting from another tab",
    } as const;
    callStore.set({ phase: reason === "removed" ? "removed" : "ended", endReason: messages[reason] });
  }

  private dispose() {
    clearTimeout(this.keyBootstrapTimer);
    for (const t of this.timers) clearInterval(t);
    for (const t of this.leaveTimers.values()) clearTimeout(t);
    for (const u of this.unsubscribers) u();
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("offline", this.onOffline);
    window.removeEventListener("pagehide", this.onPageHide);
    this.captions.stop();
    this.recorder.stop();
    this.screen.stop();
    this.stats.stop();
    this.detector.dispose();
    this.peers.closeAll();
    this.whiteboard.dispose();
    this.e2ee?.dispose();
    void this.signaling.disconnect();
    this.media.dispose();
  }

  // ── Presence & peers ───────────────────────────────────────────────────────

  private isLeader(): boolean {
    let leader: { id: string; joinedAt: number } = { id: this.selfId, joinedAt: this.joinedAt };
    for (const p of this.presence.values()) {
      if (p.joinedAt < leader.joinedAt || (p.joinedAt === leader.joinedAt && p.participantId < leader.id)) {
        leader = { id: p.participantId, joinedAt: p.joinedAt };
      }
    }
    return leader.id === this.selfId;
  }

  private onPresence(list: PresenceInfo[]) {
    const latest = new Map<string, PresenceInfo>();
    for (const p of list) {
      if (p.participantId === this.selfId) {
        if (p.sessionId !== this.sessionId && p.joinedAt > this.joinedAt) void this.end("duplicate");
        continue;
      }
      const prev = latest.get(p.participantId);
      if (!prev || p.joinedAt > prev.joinedAt) latest.set(p.participantId, p);
    }

    const state = callStore.get();
    const nextParticipants: Record<string, RemoteParticipant> = { ...state.participants };

    for (const [id, p] of latest) {
      clearTimeout(this.leaveTimers.get(id));
      this.leaveTimers.delete(id);
      const before = this.presence.get(id);
      const existing = nextParticipants[id];
      this.peers.ensurePeer(id, p.sessionId);
      const sessionChanged = existing && existing.sessionId !== p.sessionId;
      if (sessionChanged) this.remoteStreams.delete(id);
      nextParticipants[id] = {
        id,
        sessionId: p.sessionId,
        displayName: sanitizeDisplayName(p.displayName),
        role: p.role,
        joinedAt: p.joinedAt,
        mic: !!p.mic,
        cam: !!p.cam,
        cameraStreamId: p.cameraStreamId,
        screenStreamId: p.screenStreamId,
        handRaisedAt: p.handRaisedAt,
        connection: sessionChanged ? "new" : (existing?.connection ?? "new"),
        quality: existing?.quality ?? "unknown",
        mediaVersion: (existing?.mediaVersion ?? 0) + (sessionChanged ? 1 : 0),
      };

      if (this.initialSyncDone && !before) {
        this.notify({ kind: "info", title: `${nextParticipants[id].displayName} joined`, id: `presence-${id}` });
      }
      if (p.handRaisedAt && p.handRaisedAt !== before?.handRaisedAt) {
        this.notify({
          kind: "info",
          title: `✋ ${nextParticipants[id].displayName} raised their hand`,
          id: `hand-${id}`,
        });
      }
      if (before?.screenStreamId !== p.screenStreamId && p.screenStreamId && this.initialSyncDone) {
        this.notify({ kind: "info", title: `${nextParticipants[id].displayName} is presenting` });
      }
      this.presence.set(id, p);
      this.maybeOfferKey(p);
    }

    // People missing from presence get a grace period (network blips cause brief leaves).
    for (const id of Object.keys(state.participants)) {
      if (latest.has(id) || this.leaveTimers.has(id)) continue;
      this.leaveTimers.set(
        id,
        setTimeout(() => this.dropParticipant(id, true), LEAVE_GRACE_MS),
      );
    }

    callStore.set({ participants: nextParticipants });
    this.initialSyncDone = true;
    this.scheduleKeyBootstrap();
  }

  private dropParticipant(id: string, announce: boolean) {
    this.leaveTimers.delete(id);
    const name = callStore.get().participants[id]?.displayName;
    this.presence.delete(id);
    this.peers.removePeer(id);
    this.remoteStreams.delete(id);
    this.detector.untrack(id);
    this.stats.forget(id);
    this.whiteboard.dropPreview(id);
    callStore.set((s) => {
      const participants = { ...s.participants };
      delete participants[id];
      const captions = { ...s.captions };
      delete captions[id];
      return { participants, captions, activeSpeakerId: s.activeSpeakerId === id ? null : s.activeSpeakerId };
    });
    if (announce && name) this.notify({ kind: "info", title: `${name} left`, id: `presence-${id}` });
  }

  private onRemoteTrack(peerId: string, track: MediaStreamTrack, stream: MediaStream) {
    let streams = this.remoteStreams.get(peerId);
    if (!streams) this.remoteStreams.set(peerId, (streams = new Map()));
    streams.set(stream.id, stream);
    const bump = () => {
      const p = callStore.get().participants[peerId];
      if (p) callStore.patchParticipant(peerId, { mediaVersion: p.mediaVersion + 1 });
      const camera = this.getStream(peerId, "camera");
      if (camera) {
        this.detector.track(peerId, camera);
        this.recorder.addAudio(peerId, camera);
      }
    };
    track.addEventListener("unmute", bump);
    track.addEventListener("ended", bump);
    stream.addEventListener("removetrack", bump);
    bump();
  }

  /** Remote media for a participant: their camera/mic stream or their screen share. */
  getStream(participantId: string, which: "camera" | "screen"): MediaStream | undefined {
    if (participantId === this.selfId)
      return which === "camera" ? this.media.stream : (this.screen.stream ?? undefined);
    const p = callStore.get().participants[participantId];
    const id = which === "camera" ? p?.cameraStreamId : p?.screenStreamId;
    return id ? this.remoteStreams.get(participantId)?.get(id) : undefined;
  }

  // ── Encryption keys ────────────────────────────────────────────────────────

  /** Only the earliest-joined holder of the best key answers, to avoid offer storms. */
  private maybeOfferKey(peer: PresenceInfo) {
    if (!this.keyring.shouldOffer({ keyId: peer.keyId, epoch: peer.keyEpoch })) return;
    const mine = this.keyring.state.keyId;
    const holders = [...this.presence.values()].filter((p) => p.keyId === mine);
    const responsible = holders.every(
      (h) => this.joinedAt < h.joinedAt || (this.joinedAt === h.joinedAt && this.selfId < h.participantId),
    );
    if (responsible && peer.ecdhPublicKey) void this.keyring.offerTo(peer.participantId, peer.ecdhPublicKey);
  }

  private scheduleKeyBootstrap() {
    clearTimeout(this.keyBootstrapTimer);
    if (this.keyring.state.ready) return;
    const attempt = () => {
      const someoneHasKey = [...this.presence.values()].some((p) => p.keyId);
      if (!this.keyring.state.ready && !someoneHasKey && this.isLeader()) void this.keyring.createKey();
    };
    // Alone in the room after the first presence sync: nobody can offer a key, so create it now.
    // Otherwise give existing members a moment to hand theirs over.
    if (this.initialSyncDone && this.presence.size === 0) attempt();
    else this.keyBootstrapTimer = setTimeout(attempt, 1500);
  }

  private async onKeyChanged(fingerprint: string | null) {
    const key = this.keyring.currentKey;
    callStore.set((s) => ({ security: { ...s.security, ready: !!key, fingerprint } }));
    if (key && this.e2ee) await this.e2ee.setKey(key.key, key.epoch);
    this.publishPresence();
    for (const p of this.presence.values()) this.maybeOfferKey(p);
    // Content that arrived before we had the key can be read now.
    for (const dto of [...this.lockedMessages.values()]) await this.ingestChat(dto, false);
    for (const dto of [...this.fileDtos.values()]) {
      const item = callStore.get().files.find((f) => f.id === dto.id);
      if (item?.status === "locked") await this.ingestFile(dto, false);
    }
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  private async onMessage(env: Envelope) {
    const fromPresence = this.presence.get(env.from);
    switch (env.type) {
      case "signal": {
        // An offer can arrive before presence tells us about its sender; set the peer up now
        // instead of dropping it (which used to stall connections for several seconds).
        const signal = env.payload as SignalMessage;
        const isOffer = signal.kind === "description" && signal.description.type === "offer";
        if (isOffer && !this.peers.has(env.from, env.fromSession)) this.peers.ensurePeer(env.from, env.fromSession);
        this.peers.handleSignal(env.from, env.fromSession, signal);
        break;
      }
      case "key-offer":
        await this.keyring.receiveOffer(env.from, env.payload as KeyOffer);
        break;
      case "chat":
        await this.ingestChat({ ...(env.payload as ChatMessageDto), participantId: env.from }, true);
        break;
      case "file":
        await this.ingestFile({ ...(env.payload as SharedFileDto), participantId: env.from }, true);
        break;
      case "reaction": {
        const emoji = (env.payload as { emoji: string }).emoji;
        if ((REACTIONS as readonly string[]).includes(emoji)) {
          this.showReaction(env.from, fromPresence?.displayName ?? "Someone", emoji);
        }
        break;
      }
      case "caption": {
        const { text } = env.payload as { text: string };
        if (typeof text === "string" && fromPresence) {
          callStore.set((s) => ({
            captions: {
              ...s.captions,
              [env.from]: {
                name: sanitizeDisplayName(fromPresence.displayName),
                text: text.slice(0, 300),
                at: Date.now(),
              },
            },
          }));
        }
        break;
      }
      case "wb": {
        const msg = env.payload as WhiteboardMessage;
        // Only the host may clear the board for everyone.
        if (msg.type === "wb:ops" && msg.ops.some((o) => o.kind === "clear") && env.from !== callStore.get().hostId) {
          msg.ops = msg.ops.filter((o) => o.kind !== "clear");
        }
        this.whiteboard.handle(env.from, msg);
        break;
      }
    }
  }

  private async onSystem(e: SystemEvent) {
    const isHost = callStore.get().self?.role === "HOST";
    switch (e.type) {
      case "waiting-changed":
      case "admitted":
      case "denied":
        if (isHost) await this.refreshParticipants();
        break;
      case "removed":
        if (e.participantId === this.selfId) return void this.end("removed");
        this.dropParticipant(e.participantId, false);
        // Rotate the content key so the removed person can't read anything new.
        if (this.isLeader()) {
          await this.keyring.rotate(
            [...this.presence.values()].map((p) => ({ id: p.participantId, publicKey: p.ecdhPublicKey })),
          );
        }
        break;
      case "mute":
        if (e.participantId === this.selfId) {
          await this.media.setMicEnabled(false);
          this.notify({ kind: "warning", title: "The host muted you", id: "muted" });
        }
        break;
      case "host-changed":
        await this.refreshParticipants();
        if (e.participantId === this.selfId) this.notify({ kind: "success", title: "You're now the host" });
        break;
      case "meeting-updated":
        callStore.set({ locked: e.locked });
        break;
      case "meeting-ended":
        await this.end(this.endingForEveryone ? "ended-by-you" : "ended");
        break;
    }
  }

  async refreshParticipants() {
    try {
      const { items } = await api<{ items: ParticipantDto[] }>(`/api/meetings/${this.code}/participants`);
      const host = items.find((p) => p.role === "HOST");
      const me = items.find((p) => p.id === this.selfId);
      const prevWaiting = callStore.get().waiting;
      const waiting = items.filter((p) => p.status === "WAITING");
      if (me && me.role !== this.self.role) {
        this.self = { ...this.self, role: me.role };
        callStore.set((s) => ({ self: s.self && { ...s.self, role: me.role } }));
        this.publishPresence();
      }
      callStore.set({ hostId: host?.id ?? null, waiting: me?.role === "HOST" ? waiting : [] });
      for (const w of waiting) {
        if (me?.role === "HOST" && !prevWaiting.some((p) => p.id === w.id)) {
          this.notify({ kind: "info", title: `${w.displayName} wants to join`, id: `waiting-${w.id}` });
        }
      }
    } catch {
      // Transient; the next system event or heartbeat retries.
    }
  }

  // ── Local media controls ───────────────────────────────────────────────────

  private async onLocalMediaChanged() {
    await this.peers.replaceTrack("audio", this.media.audioTrack);
    await this.peers.replaceTrack("video", this.media.videoTrack);
    this.detector.track(this.selfId, this.media.stream);
    callStore.set((s) => ({
      local: {
        ...s.local,
        mic: this.media.micEnabled && !!this.media.audioTrack,
        cam: this.media.camEnabled && !!this.media.videoTrack,
        videoTrackId: this.media.videoTrack?.id ?? null,
      },
    }));
    this.publishPresence();
  }

  toggleMic() {
    return this.media.setMicEnabled(!callStore.get().local.mic);
  }

  toggleCamera() {
    return this.media.setCameraEnabled(!callStore.get().local.cam);
  }

  async toggleScreenShare() {
    if (this.screen.active) return this.screen.stop();
    if (!ScreenShareController.supported) {
      this.notify({ kind: "warning", title: "Screen sharing isn't supported in this browser" });
      return;
    }
    const presenter = Object.values(callStore.get().participants).find((p) => p.screenStreamId);
    if (presenter) {
      this.notify({
        kind: "info",
        title: `${presenter.displayName} is already presenting`,
        description: "Your share will appear alongside theirs.",
      });
    }
    try {
      const stream = await this.screen.start();
      this.peers.startScreenShare(stream);
      callStore.set((s) => ({ local: { ...s.local, screen: true } }));
      this.publishPresence();
    } catch (e) {
      if ((e as DOMException).name !== "NotAllowedError") {
        this.notify({ kind: "error", title: "Couldn't start screen sharing" });
      }
    }
  }

  private onScreenShareEnded() {
    this.peers.stopScreenShare();
    callStore.set((s) => ({ local: { ...s.local, screen: false } }));
    this.publishPresence();
  }

  toggleHand() {
    const raised = callStore.get().local.handRaisedAt;
    callStore.set((s) => ({ local: { ...s.local, handRaisedAt: raised ? null : Date.now() } }));
    this.publishPresence();
  }

  lowerHandOf(participantId: string) {
    if (participantId === this.selfId && callStore.get().local.handRaisedAt) this.toggleHand();
  }

  sendReaction(emoji: (typeof REACTIONS)[number]) {
    this.signaling.send(null, "reaction", { emoji });
    this.showReaction(this.selfId, "You", emoji);
  }

  private showReaction(participantId: string, name: string, emoji: string) {
    const id = crypto.randomUUID();
    callStore.set((s) => ({ reactions: [...s.reactions.slice(-20), { id, emoji, participantId, name }] }));
    setTimeout(() => callStore.set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) })), 4000);
  }

  toggleCaptions() {
    const on = !callStore.get().local.captions;
    if (on && !this.captions.start()) {
      this.notify({ kind: "warning", title: "Live captions aren't supported in this browser" });
      return;
    }
    if (!on) this.captions.stop();
    callStore.set((s) => ({ local: { ...s.local, captions: on } }));
  }

  private lastCaptionSent = 0;
  private onLocalCaption(text: string, final: boolean) {
    callStore.set((s) => ({ captions: { ...s.captions, [this.selfId]: { name: "You", text, at: Date.now() } } }));
    const now = Date.now();
    if (final || now - this.lastCaptionSent > 400) {
      this.lastCaptionSent = now;
      this.signaling.send(null, "caption", { text });
    }
  }

  async toggleRecording() {
    if (this.recorder.active) return this.recorder.stop();
    if (!LocalRecorder.supported) {
      this.notify({ kind: "warning", title: "Recording isn't supported in this browser" });
      return;
    }
    const sources = new Map<string, MediaStream>([[this.selfId, this.media.stream]]);
    for (const id of Object.keys(callStore.get().participants)) {
      const s = this.getStream(id, "camera");
      if (s) sources.set(id, s);
    }
    try {
      await this.recorder.start(sources, () => callStore.set((s) => ({ local: { ...s.local, recording: false } })));
      callStore.set((s) => ({ local: { ...s.local, recording: true } }));
      this.notify({ kind: "info", title: "Recording to this device", description: "It downloads when you stop." });
    } catch {
      // User dismissed the capture picker.
    }
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  async sendChat(raw: string) {
    const text = sanitizeChatText(raw);
    if (!text) return;
    if (!this.keyring.state.ready) {
      this.notify({ kind: "warning", title: "Setting up encryption…", description: "Try again in a moment." });
      return;
    }
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    callStore.upsertMessage({
      id,
      participantId: this.selfId,
      senderName: this.self.displayName,
      text,
      createdAt,
      status: "pending",
    });
    try {
      const payload: ChatPlaintext = { text, senderName: this.self.displayName };
      const enc = await this.keyring.encryptChat(payload);
      const body = { id, ...enc };
      this.signaling.send(null, "chat", { ...body, createdAt: new Date(createdAt).toISOString() });
      await api(`/api/meetings/${this.code}/messages`, { method: "POST", body });
      callStore.upsertMessage({
        id,
        participantId: this.selfId,
        senderName: this.self.displayName,
        text,
        createdAt,
        status: "sent",
      });
    } catch {
      callStore.upsertMessage({
        id,
        participantId: this.selfId,
        senderName: this.self.displayName,
        text,
        createdAt,
        status: "failed",
      });
    }
  }

  private async ingestChat(dto: ChatMessageDto, live: boolean) {
    if (callStore.get().messages.some((m) => m.id === dto.id && m.status !== "locked")) return;
    const createdAt = Date.parse(dto.createdAt) || Date.now();
    try {
      if (!this.keyring.hasKey(dto.keyId)) throw new Error("no key");
      const plain = await this.keyring.decryptChat<ChatPlaintext>(dto.keyId, dto.iv, dto.ciphertext);
      this.lockedMessages.delete(dto.id);
      const senderName =
        dto.participantId === this.selfId
          ? this.self.displayName
          : sanitizeDisplayName(plain.senderName, "Participant");
      callStore.upsertMessage({
        id: dto.id,
        participantId: dto.participantId,
        senderName,
        text: sanitizeChatText(plain.text),
        createdAt,
        status: "sent",
      });
      if (live && dto.participantId !== this.selfId) callStore.set((s) => ({ unread: s.unread + 1 }));
    } catch {
      this.lockedMessages.set(dto.id, dto);
      callStore.upsertMessage({
        id: dto.id,
        participantId: dto.participantId,
        senderName: this.presence.get(dto.participantId)?.displayName ?? "Participant",
        text: "",
        createdAt,
        status: "locked",
      });
    }
  }

  private async loadChatHistory() {
    try {
      const { items } = await api<{ items: ChatMessageDto[] }>(`/api/meetings/${this.code}/messages`);
      for (const m of items) await this.ingestChat(m, false);
    } catch {
      // History is best-effort.
    }
  }

  markChatRead() {
    callStore.set({ unread: 0 });
  }

  // ── Files ──────────────────────────────────────────────────────────────────

  async shareFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      this.notify({ kind: "error", title: `${file.name} is larger than 50 MB` });
      return;
    }
    if (!this.keyring.state.ready) {
      this.notify({ kind: "warning", title: "Setting up encryption…", description: "Try again in a moment." });
      return;
    }
    const id = crypto.randomUUID();
    const base = {
      id,
      participantId: this.selfId,
      senderName: this.self.displayName,
      name: file.name.slice(0, 200),
      type: file.type || "application/octet-stream",
      size: file.size,
      createdAt: Date.now(),
    };
    callStore.upsertFile({ ...base, status: "uploading", progress: 0 });
    try {
      const meta: FileMeta = { name: base.name, type: base.type, size: file.size };
      const enc = await this.keyring.encryptFile(id, await file.arrayBuffer(), meta);
      const { file: dto, upload } = await api<{ file: SharedFileDto; upload: { url: string } }>(
        `/api/meetings/${this.code}/files`,
        {
          method: "POST",
          body: {
            id,
            keyId: enc.keyId,
            iv: enc.iv,
            encryptedMeta: enc.encryptedMeta,
            metaIv: enc.metaIv,
            sizeBytes: enc.ciphertext.byteLength,
          },
        },
      );
      await uploadWithProgress(upload.url, new Blob([enc.ciphertext]), (progress) =>
        callStore.upsertFile({ id, progress }),
      );
      await api(`/api/meetings/${this.code}/files/${id}/complete`, { method: "POST" });
      this.fileDtos.set(id, dto);
      this.signaling.send(null, "file", dto);
      callStore.upsertFile({ id, status: "ready", progress: 1 });
    } catch (e) {
      callStore.upsertFile({ id, status: "failed" });
      this.notify({ kind: "error", title: `Couldn't share ${file.name}`, description: (e as Error).message });
    }
  }

  private async ingestFile(dto: SharedFileDto, live: boolean) {
    this.fileDtos.set(dto.id, dto);
    const existing = callStore.get().files.find((f) => f.id === dto.id);
    if (existing && existing.status !== "locked") return;
    const senderName =
      dto.participantId === this.selfId
        ? this.self.displayName
        : (this.presence.get(dto.participantId)?.displayName ?? "Participant");
    try {
      if (!this.keyring.hasKey(dto.keyId)) throw new Error("no key");
      const meta = await this.keyring.decryptFileMeta<FileMeta>(dto.id, dto.keyId, dto.metaIv, dto.encryptedMeta);
      callStore.upsertFile({
        id: dto.id,
        participantId: dto.participantId,
        senderName: sanitizeDisplayName(senderName),
        name: sanitizeDisplayName(meta.name, "file"),
        type: typeof meta.type === "string" ? meta.type : "application/octet-stream",
        size: Number(meta.size) || dto.sizeBytes,
        createdAt: Date.parse(dto.createdAt) || Date.now(),
        status: "ready",
        progress: 1,
      });
      if (live && dto.participantId !== this.selfId) {
        this.notify({ kind: "info", title: `${senderName} shared a file`, description: meta.name });
      }
    } catch {
      callStore.upsertFile({
        id: dto.id,
        participantId: dto.participantId,
        senderName,
        name: "Encrypted file",
        type: "application/octet-stream",
        size: dto.sizeBytes,
        createdAt: Date.parse(dto.createdAt) || Date.now(),
        status: "locked",
        progress: 0,
      });
    }
  }

  private async loadFiles() {
    try {
      const { items } = await api<{ items: SharedFileDto[] }>(`/api/meetings/${this.code}/files`);
      for (const f of items) await this.ingestFile(f, false);
    } catch {
      // Best-effort.
    }
  }

  async downloadFile(id: string) {
    const dto = this.fileDtos.get(id);
    const item = callStore.get().files.find((f) => f.id === id);
    if (!dto || !item) return;
    callStore.upsertFile({ id, status: "downloading" });
    try {
      const { url } = await api<{ url: string }>(`/api/meetings/${this.code}/files/${id}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const plain = await this.keyring.decryptFile(id, dto.keyId, dto.iv, await res.arrayBuffer());
      saveBlob(new Blob([plain], { type: item.type }), item.name);
    } catch (e) {
      this.notify({ kind: "error", title: "Couldn't download file", description: (e as Error).message });
    } finally {
      callStore.upsertFile({ id, status: "ready" });
    }
  }

  // ── Whiteboard ─────────────────────────────────────────────────────────────

  private async loadWhiteboard() {
    try {
      const board = await api<{ elements: BoardElement[] }>(`/api/meetings/${this.code}/whiteboard`);
      this.whiteboard.loadPersisted(board.elements);
    } catch {
      // Start empty; peers will send state.
    }
    this.whiteboard.requestState();
  }

  /** Large snapshots are split to stay under Realtime's message size limit. */
  private sendWhiteboardTo(peerId: string, msg: WhiteboardMessage) {
    const session = this.presence.get(peerId)?.sessionId;
    if (msg.type !== "wb:state") return this.signaling.send(peerId, "wb", msg, session);
    const chunks: BoardElement[][] = [];
    let current: BoardElement[] = [];
    let size = 0;
    for (const el of msg.elements) {
      const s = JSON.stringify(el).length;
      if (size + s > 150_000 && current.length) {
        chunks.push(current);
        current = [];
        size = 0;
      }
      current.push(el);
      size += s;
    }
    chunks.push(current);
    for (const elements of chunks) {
      this.signaling.send(peerId, "wb", { ...msg, elements }, session);
    }
  }

  get isHost() {
    return callStore.get().self?.role === "HOST";
  }

  // ── Host controls ──────────────────────────────────────────────────────────

  async hostAction(body: { action: string; participantId?: string }) {
    if (body.action === "end") this.endingForEveryone = true;
    try {
      await api(`/api/meetings/${this.code}/host`, { method: "POST", body });
      if (body.action === "end") return void this.end("ended-by-you");
      await this.refreshParticipants();
    } catch (e) {
      this.endingForEveryone = false;
      this.notify({ kind: "error", title: (e as Error).message });
    }
  }

  async setLocked(locked: boolean) {
    try {
      await api(`/api/meetings/${this.code}`, { method: "PATCH", body: { locked } });
      callStore.set({ locked });
      this.notify({ kind: "success", title: locked ? "Meeting locked" : "Meeting unlocked" });
    } catch (e) {
      this.notify({ kind: "error", title: (e as Error).message });
    }
  }
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
