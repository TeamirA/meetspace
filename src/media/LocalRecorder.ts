/**
 * Local-only recording: captures the meeting tab (what you see) plus a mix of everyone's audio
 * with MediaRecorder, then downloads a .webm file. Nothing is uploaded anywhere.
 */
export class LocalRecorder {
  private recorder?: MediaRecorder;
  private display?: MediaStream;
  private ctx?: AudioContext;
  private destination?: MediaStreamAudioDestinationNode;
  private mixed = new Map<string, MediaStreamAudioSourceNode>();
  private chunks: Blob[] = [];

  static get supported() {
    return typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getDisplayMedia;
  }

  get active() {
    return this.recorder?.state === "recording";
  }

  async start(audioSources: Map<string, MediaStream>, onStopped: () => void) {
    this.display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: "include",
    } as DisplayMediaStreamOptions);
    this.ctx = new AudioContext();
    this.destination = this.ctx.createMediaStreamDestination();
    for (const [id, s] of audioSources) this.addAudio(id, s);

    const stream = new MediaStream([...this.display.getVideoTracks(), ...this.destination.stream.getAudioTracks()]);
    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, { ...(mimeType && { mimeType }), videoBitsPerSecond: 2_500_000 });
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.onstop = () => {
      this.download();
      this.cleanup();
      onStopped();
    };
    this.display.getVideoTracks()[0]?.addEventListener("ended", () => this.stop());
    this.recorder.start(1000);
  }

  addAudio(id: string, stream: MediaStream) {
    if (!this.ctx || !this.destination || this.mixed.has(id)) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    const node = this.ctx.createMediaStreamSource(new MediaStream([track]));
    node.connect(this.destination);
    this.mixed.set(id, node);
  }

  stop() {
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
  }

  private download() {
    if (!this.chunks.length) return;
    const blob = new Blob(this.chunks, { type: this.chunks[0].type || "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meetspace-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  private cleanup() {
    this.display?.getTracks().forEach((t) => t.stop());
    for (const n of this.mixed.values()) n.disconnect();
    this.mixed.clear();
    void this.ctx?.close().catch(() => undefined);
    this.recorder = undefined;
  }
}
