interface Source {
  node: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  buffer: Float32Array<ArrayBuffer>;
  level: number;
  trackId: string;
}

/**
 * Measures speech level per participant with the Web Audio API and picks an active speaker.
 * A short hold time stops the spotlight from flickering between people on every breath.
 */
export class ActiveSpeakerDetector {
  private ctx?: AudioContext;
  private sources = new Map<string, Source>();
  private timer?: ReturnType<typeof setInterval>;
  private candidate: { id: string; since: number } | null = null;
  activeSpeakerId: string | null = null;

  constructor(
    private readonly onChange: (id: string | null) => void,
    private readonly onLevels?: (levels: Map<string, number>) => void,
    private readonly opts = { threshold: 0.025, holdMs: 400, intervalMs: 120 },
  ) {}

  private context() {
    this.ctx ??= new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  /** (Re)attach the audio track of `stream` for participant `id`. No-op if unchanged. */
  track(id: string, stream: MediaStream | null | undefined) {
    const audio = stream?.getAudioTracks()[0];
    const existing = this.sources.get(id);
    if (existing && audio && existing.trackId === audio.id) return;
    this.untrack(id);
    if (!audio) return;
    try {
      const ctx = this.context();
      const node = ctx.createMediaStreamSource(new MediaStream([audio]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      node.connect(analyser);
      this.sources.set(id, { node, analyser, buffer: new Float32Array(analyser.fftSize), level: 0, trackId: audio.id });
      this.timer ??= setInterval(() => this.tick(), this.opts.intervalMs);
    } catch {
      // AudioContext unavailable (e.g. autoplay policy before any gesture); detection is optional.
    }
  }

  untrack(id: string) {
    const s = this.sources.get(id);
    if (!s) return;
    s.node.disconnect();
    this.sources.delete(id);
  }

  levelOf(id: string) {
    return this.sources.get(id)?.level ?? 0;
  }

  private tick() {
    const levels = new Map<string, number>();
    let loudest: { id: string; level: number } | null = null;
    for (const [id, s] of this.sources) {
      s.analyser.getFloatTimeDomainData(s.buffer);
      let sum = 0;
      for (const v of s.buffer) sum += v * v;
      const rms = Math.sqrt(sum / s.buffer.length);
      s.level = s.level * 0.6 + rms * 0.4;
      levels.set(id, s.level);
      if (s.level > this.opts.threshold && (!loudest || s.level > loudest.level)) loudest = { id, level: s.level };
    }
    this.onLevels?.(levels);

    const now = performance.now();
    if (!loudest) {
      this.candidate = null;
      return;
    }
    if (this.candidate?.id !== loudest.id) this.candidate = { id: loudest.id, since: now };
    if (now - this.candidate.since >= this.opts.holdMs && this.activeSpeakerId !== loudest.id) {
      this.activeSpeakerId = loudest.id;
      this.onChange(loudest.id);
    }
  }

  dispose() {
    clearInterval(this.timer);
    for (const id of [...this.sources.keys()]) this.untrack(id);
    void this.ctx?.close().catch(() => undefined);
  }
}

/** Standalone level meter for the lobby preview. */
export function createLevelMeter(stream: MediaStream, onLevel: (level: number) => void) {
  const audio = stream.getAudioTracks()[0];
  if (!audio) return () => undefined;
  const ctx = new AudioContext();
  const node = ctx.createMediaStreamSource(new MediaStream([audio]));
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  node.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let raf = 0;
  const loop = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => {
    cancelAnimationFrame(raf);
    node.disconnect();
    void ctx.close().catch(() => undefined);
  };
}
