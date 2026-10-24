/**
 * Wraps getDisplayMedia. The browser's own "Stop sharing" button ends the video track, which
 * we surface through `onEnded` so the app state stays in sync.
 */
export class ScreenShareController {
  stream: MediaStream | null = null;

  constructor(private readonly onEnded: () => void) {}

  get active() {
    return !!this.stream;
  }

  static get supported() {
    return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
  }

  async start(): Promise<MediaStream> {
    const options = {
      video: { frameRate: { ideal: 30, max: 30 } },
      // System/tab audio where the browser supports it (Chrome on Windows/ChromeOS, tab audio elsewhere).
      audio: { suppressLocalAudioPlayback: false },
      systemAudio: "include",
      surfaceSwitching: "include",
      selfBrowserSurface: "exclude",
    } as DisplayMediaStreamOptions;
    const stream = await navigator.mediaDevices.getDisplayMedia(options);
    const video = stream.getVideoTracks()[0];
    if (video) {
      video.contentHint = "detail";
      video.addEventListener("ended", () => this.stop());
    }
    this.stream = stream;
    return stream;
  }

  stop() {
    if (!this.stream) return;
    const s = this.stream;
    this.stream = null;
    s.getTracks().forEach((t) => t.stop());
    this.onEnded();
  }
}
