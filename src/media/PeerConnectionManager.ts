import type { MediaE2EE } from "./MediaE2EE";

export type SignalMessage =
  | { kind: "description"; description: RTCSessionDescriptionInit }
  | { kind: "candidate"; candidate: RTCIceCandidateInit };

export interface PeerHandlers {
  /** Send a signaling message to one remote session. */
  signal(peerId: string, sessionId: string, msg: SignalMessage): void;
  onTrack(peerId: string, track: MediaStreamTrack, stream: MediaStream): void;
  onConnectionState(peerId: string, state: RTCPeerConnectionState): void;
  onData(peerId: string, data: unknown): void;
}

interface Peer {
  id: string;
  sessionId: string;
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  queue: Promise<void>;
  audioSender: RTCRtpSender;
  videoSender: RTCRtpSender;
  screenSenders: RTCRtpSender[];
  channel: RTCDataChannel;
  disconnectTimer?: ReturnType<typeof setTimeout>;
}

export interface LocalTracks {
  stream: MediaStream;
  audio: MediaStreamTrack | null;
  video: MediaStreamTrack | null;
  screen: MediaStream | null;
}

/**
 * Mesh of RTCPeerConnections, one per remote participant session, using the "perfect
 * negotiation" pattern: either side may renegotiate at any time (screen share, device changes,
 * ICE restarts) and offer collisions are resolved by the polite/impolite roles.
 */
export class PeerConnectionManager {
  private peers = new Map<string, Peer>();
  private iceServers: RTCIceServer[];

  constructor(
    private readonly selfId: string,
    iceServers: RTCIceServer[],
    private readonly local: () => LocalTracks,
    private readonly handlers: PeerHandlers,
    private readonly e2ee?: MediaE2EE,
  ) {
    this.iceServers = iceServers;
  }

  get connections(): Map<string, RTCPeerConnection> {
    return new Map([...this.peers].map(([id, p]) => [id, p.pc]));
  }

  has(peerId: string, sessionId?: string) {
    const p = this.peers.get(peerId);
    return !!p && (!sessionId || p.sessionId === sessionId);
  }

  sessionOf(peerId: string) {
    return this.peers.get(peerId)?.sessionId;
  }

  setIceServers(servers: RTCIceServer[]) {
    this.iceServers = servers;
    for (const p of this.peers.values()) {
      try {
        p.pc.setConfiguration({ ...p.pc.getConfiguration(), iceServers: servers });
      } catch {
        // Some browsers reject config changes on live connections; new peers get the update.
      }
    }
  }

  /** Creates (or replaces, if the remote tab reloaded) the connection to a peer session. */
  ensurePeer(peerId: string, sessionId: string): void {
    const existing = this.peers.get(peerId);
    if (existing?.sessionId === sessionId) return;
    if (existing) this.removePeer(peerId);

    const config: RTCConfiguration & { encodedInsertableStreams?: boolean } = {
      iceServers: this.iceServers,
      bundlePolicy: "max-bundle",
      ...(this.e2ee?.needsInsertableStreamsFlag && { encodedInsertableStreams: true }),
    };
    const pc = new RTCPeerConnection(config);
    const local = this.local();
    const addSender = (kind: "audio" | "video", track: MediaStreamTrack | null) =>
      track
        ? pc.addTrack(track, local.stream)
        : pc.addTransceiver(kind, { direction: "sendrecv", streams: [local.stream] }).sender;

    // Pre-negotiated channel (same id on both ends) avoids an extra datachannel handshake race.
    const channel = pc.createDataChannel("fast", { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 });
    const peer: Peer = {
      id: peerId,
      sessionId,
      pc,
      polite: this.selfId < peerId,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      queue: Promise.resolve(),
      audioSender: addSender("audio", local.audio),
      videoSender: addSender("video", local.video),
      screenSenders: [],
      channel,
    };
    this.peers.set(peerId, peer);
    if (this.e2ee) {
      this.e2ee.preferVp8(pc);
      this.e2ee.attachSender(peer.audioSender, "audio");
      this.e2ee.attachSender(peer.videoSender, "video");
    }
    if (local.screen) this.addScreenToPeer(peer, local.screen);

    channel.onmessage = (e) => {
      try {
        this.handlers.onData(peerId, JSON.parse(e.data as string));
      } catch {
        // Ignore malformed frames.
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) {
          this.handlers.signal(peerId, sessionId, { kind: "description", description: pc.localDescription.toJSON() });
        }
      } catch (e) {
        console.warn("[webrtc] negotiation failed", e);
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.handlers.signal(peerId, sessionId, { kind: "candidate", candidate: candidate.toJSON() });
    };

    pc.ontrack = (e) => {
      if (this.e2ee) this.e2ee.attachReceiver(e.receiver, e.track.kind as "audio" | "video");
      const stream = e.streams[0];
      if (stream) this.handlers.onTrack(peerId, e.track, stream);
    };

    pc.onconnectionstatechange = () => {
      this.handlers.onConnectionState(peerId, pc.connectionState);
      if (pc.connectionState === "failed") pc.restartIce();
    };

    pc.oniceconnectionstatechange = () => {
      clearTimeout(peer.disconnectTimer);
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      } else if (pc.iceConnectionState === "disconnected") {
        // Brief blips often recover by themselves; restart ICE if this one doesn't.
        peer.disconnectTimer = setTimeout(() => {
          if (pc.iceConnectionState === "disconnected") pc.restartIce();
        }, 3000);
      }
    };
  }

  /** Serialized per peer so candidates never race ahead of their remote description. */
  handleSignal(peerId: string, sessionId: string, msg: SignalMessage) {
    const peer = this.peers.get(peerId);
    if (!peer || peer.sessionId !== sessionId) return;
    peer.queue = peer.queue.then(() => this.process(peer, msg)).catch((e) => console.warn("[webrtc] signal", e));
  }

  private async process(peer: Peer, msg: SignalMessage) {
    const { pc } = peer;
    if (msg.kind === "description") {
      const description = msg.description;
      const readyForOffer = !peer.makingOffer && (pc.signalingState === "stable" || peer.isSettingRemoteAnswerPending);
      const offerCollision = description.type === "offer" && !readyForOffer;
      peer.ignoreOffer = !peer.polite && offerCollision;
      if (peer.ignoreOffer) return;

      peer.isSettingRemoteAnswerPending = description.type === "answer";
      await pc.setRemoteDescription(description); // implicit rollback when polite and colliding
      peer.isSettingRemoteAnswerPending = false;
      if (description.type === "offer") {
        await pc.setLocalDescription();
        if (pc.localDescription) {
          this.handlers.signal(peer.id, peer.sessionId, {
            kind: "description",
            description: pc.localDescription.toJSON(),
          });
        }
      }
    } else {
      try {
        await pc.addIceCandidate(msg.candidate);
      } catch (e) {
        if (!peer.ignoreOffer) throw e;
      }
    }
  }

  /** Swaps the outgoing camera/mic track on every connection without renegotiation. */
  async replaceTrack(kind: "audio" | "video", track: MediaStreamTrack | null) {
    await Promise.all(
      [...this.peers.values()].map((p) =>
        (kind === "audio" ? p.audioSender : p.videoSender).replaceTrack(track).catch(() => undefined),
      ),
    );
  }

  private addScreenToPeer(peer: Peer, screen: MediaStream) {
    for (const track of screen.getTracks()) {
      const sender = peer.pc.addTrack(track, screen);
      this.e2ee?.attachSender(sender, track.kind as "audio" | "video");
      peer.screenSenders.push(sender);
    }
  }

  /** Adds the screen-share tracks as extra senders (renegotiates via perfect negotiation). */
  startScreenShare(screen: MediaStream) {
    for (const p of this.peers.values()) this.addScreenToPeer(p, screen);
  }

  stopScreenShare() {
    for (const p of this.peers.values()) {
      for (const s of p.screenSenders) {
        try {
          p.pc.removeTrack(s);
        } catch {
          // Already closed.
        }
      }
      p.screenSenders = [];
    }
  }

  /** Low-latency, unreliable broadcast over data channels; returns peers it could not reach. */
  sendData(payload: unknown): string[] {
    const data = JSON.stringify(payload);
    const unreachable: string[] = [];
    for (const p of this.peers.values()) {
      if (p.channel.readyState === "open" && data.length < 60_000) p.channel.send(data);
      else unreachable.push(p.id);
    }
    return unreachable;
  }

  restartIceAll() {
    for (const p of this.peers.values()) p.pc.restartIce();
  }

  removePeer(peerId: string) {
    const p = this.peers.get(peerId);
    if (!p) return;
    clearTimeout(p.disconnectTimer);
    p.pc.onnegotiationneeded = null;
    p.pc.onicecandidate = null;
    p.pc.ontrack = null;
    p.pc.onconnectionstatechange = null;
    p.channel.close();
    p.pc.close();
    this.peers.delete(peerId);
  }

  closeAll() {
    for (const id of [...this.peers.keys()]) this.removePeer(id);
  }
}
