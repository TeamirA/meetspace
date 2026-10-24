export type ConnectionQuality = "good" | "fair" | "poor" | "unknown";

export interface PeerStats {
  quality: ConnectionQuality;
  rttMs: number | null;
  packetLossPct: number | null;
  jitterMs: number | null;
  relayed: boolean;
}

interface Counters {
  received: number;
  lost: number;
}

/** Classifies a link from round-trip time and recent packet loss. */
export function classifyQuality(rttMs: number | null, lossPct: number | null): ConnectionQuality {
  if (rttMs === null && lossPct === null) return "unknown";
  const rtt = rttMs ?? 0;
  const loss = lossPct ?? 0;
  if (rtt < 250 && loss < 2) return "good";
  if (rtt < 500 && loss < 8) return "fair";
  return "poor";
}

/**
 * Polls `getStats()` for each peer and reports a coarse quality level. Packet loss is computed
 * from deltas between polls so old losses don't haunt the indicator forever.
 */
export class ConnectionStatsMonitor {
  private timer?: ReturnType<typeof setInterval>;
  private previous = new Map<string, Counters>();

  constructor(
    private readonly getPeers: () => Map<string, RTCPeerConnection>,
    private readonly onStats: (peerId: string, stats: PeerStats) => void,
    private readonly intervalMs = 2000,
  ) {}

  start() {
    this.timer ??= setInterval(() => void this.poll(), this.intervalMs);
  }

  private async poll() {
    for (const [peerId, pc] of this.getPeers()) {
      if (pc.connectionState === "closed") continue;
      try {
        this.onStats(peerId, this.read(peerId, await pc.getStats()));
      } catch {
        // Peer closed mid-poll.
      }
    }
  }

  private read(peerId: string, report: RTCStatsReport): PeerStats {
    let rttMs: number | null = null;
    let jitterMs: number | null = null;
    let relayed = false;
    let received = 0;
    let lost = 0;
    const byId = new Map<string, RTCStats & Record<string, unknown>>();
    report.forEach((s) => byId.set(s.id, s as RTCStats & Record<string, unknown>));

    for (const s of byId.values()) {
      if (s.type === "candidate-pair" && s.state === "succeeded" && (s.nominated || s.selected)) {
        if (typeof s.currentRoundTripTime === "number") rttMs = s.currentRoundTripTime * 1000;
        const local = byId.get(s.localCandidateId as string);
        relayed = local?.candidateType === "relay";
      }
      if (s.type === "inbound-rtp") {
        received += (s.packetsReceived as number) ?? 0;
        lost += Math.max(0, (s.packetsLost as number) ?? 0);
        if (s.kind === "audio" && typeof s.jitter === "number") jitterMs = s.jitter * 1000;
      }
    }

    const prev = this.previous.get(peerId) ?? { received: 0, lost: 0 };
    this.previous.set(peerId, { received, lost });
    const dReceived = received - prev.received;
    const dLost = lost - prev.lost;
    const packetLossPct = dReceived + dLost > 0 ? (dLost / (dReceived + dLost)) * 100 : null;

    return { quality: classifyQuality(rttMs, packetLossPct), rttMs, packetLossPct, jitterMs, relayed };
  }

  forget(peerId: string) {
    this.previous.delete(peerId);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
