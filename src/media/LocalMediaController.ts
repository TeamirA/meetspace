export interface MediaSettings {
  microphoneId?: string;
  cameraId?: string;
  speakerId?: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

export interface DeviceLists {
  microphones: MediaDeviceInfo[];
  cameras: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
}

export type MediaErrorKind = "denied" | "not-found" | "in-use" | "unknown";

export function classifyMediaError(e: unknown): MediaErrorKind {
  const name = (e as DOMException)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "not-found";
  if (name === "NotReadableError" || name === "AbortError") return "in-use";
  return "unknown";
}

type Listener = () => void;

/**
 * Owns the local camera and microphone. `stream` keeps a stable id for the whole call so remote
 * peers can map our camera tracks (msid) even as tracks are swapped on device changes.
 * Muting the mic flips `track.enabled` (instant, no prompt); turning the camera off stops the
 * track so the hardware light goes off.
 */
export class LocalMediaController {
  readonly stream = new MediaStream();
  audioTrack: MediaStreamTrack | null = null;
  videoTrack: MediaStreamTrack | null = null;
  micEnabled = true;
  camEnabled = true;
  settings: MediaSettings = { noiseSuppression: true, echoCancellation: true, autoGainControl: true };
  lastError: { kind: MediaErrorKind; device: "mic" | "cam" } | null = null;
  private listeners = new Set<Listener>();
  private disposed = false;

  constructor(initial?: Partial<MediaSettings>) {
    this.settings = { ...this.settings, ...initial };
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", this.onDeviceChange);
    }
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private onDeviceChange = () => this.emit();

  private audioConstraints(): MediaTrackConstraints {
    const { microphoneId, noiseSuppression, echoCancellation, autoGainControl } = this.settings;
    return {
      ...(microphoneId && { deviceId: { exact: microphoneId } }),
      noiseSuppression,
      echoCancellation,
      autoGainControl,
    };
  }

  private videoConstraints(): MediaTrackConstraints {
    const { cameraId } = this.settings;
    return {
      ...(cameraId && { deviceId: { exact: cameraId } }),
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    };
  }

  /** Requests both devices up front (one permission prompt), honoring the lobby toggles. */
  async start(opts: { audio: boolean; video: boolean }) {
    this.micEnabled = opts.audio;
    this.camEnabled = opts.video;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: this.audioConstraints(),
        video: opts.video ? this.videoConstraints() : false,
      });
      const audio = s.getAudioTracks()[0] ?? null;
      if (audio) {
        audio.enabled = opts.audio;
        this.setTrack("audio", audio);
      }
      if (opts.video) this.setTrack("video", s.getVideoTracks()[0] ?? null);
    } catch (e) {
      // Retry individually so a missing camera doesn't also cost us the microphone.
      await this.acquire("audio").catch(() => undefined);
      if (opts.video) await this.acquire("video").catch(() => undefined);
      if (!this.audioTrack && !this.videoTrack) this.lastError = { kind: classifyMediaError(e), device: "mic" };
    }
    this.emit();
  }

  private async acquire(kind: "audio" | "video") {
    try {
      const s = await navigator.mediaDevices.getUserMedia(
        kind === "audio" ? { audio: this.audioConstraints() } : { video: this.videoConstraints() },
      );
      const track = kind === "audio" ? s.getAudioTracks()[0] : s.getVideoTracks()[0];
      if (kind === "audio") track.enabled = this.micEnabled;
      this.setTrack(kind, track ?? null);
      this.lastError = null;
    } catch (e) {
      this.lastError = { kind: classifyMediaError(e), device: kind === "audio" ? "mic" : "cam" };
      throw e;
    }
  }

  private setTrack(kind: "audio" | "video", track: MediaStreamTrack | null) {
    if (this.disposed) {
      track?.stop();
      return;
    }
    const old = kind === "audio" ? this.audioTrack : this.videoTrack;
    if (old && old !== track) {
      this.stream.removeTrack(old);
      old.stop();
    }
    if (track) {
      this.stream.addTrack(track);
      track.addEventListener("ended", () => {
        // Device unplugged or revoked: reflect it in the UI.
        if ((kind === "audio" ? this.audioTrack : this.videoTrack) === track) {
          if (kind === "video") this.camEnabled = false;
          this.setTrack(kind, null);
          this.emit();
        }
      });
    }
    if (kind === "audio") this.audioTrack = track;
    else this.videoTrack = track;
  }

  async setMicEnabled(enabled: boolean) {
    this.micEnabled = enabled;
    if (enabled && !this.audioTrack) await this.acquire("audio").catch(() => (this.micEnabled = false));
    if (this.audioTrack) this.audioTrack.enabled = this.micEnabled;
    this.emit();
  }

  async setCameraEnabled(enabled: boolean) {
    this.camEnabled = enabled;
    if (enabled) {
      if (!this.videoTrack) await this.acquire("video").catch(() => (this.camEnabled = false));
    } else {
      this.setTrack("video", null);
    }
    this.emit();
  }

  async switchMicrophone(deviceId: string) {
    this.settings.microphoneId = deviceId;
    await this.acquire("audio").catch(() => undefined);
    this.emit();
  }

  async switchCamera(deviceId: string) {
    this.settings.cameraId = deviceId;
    if (this.camEnabled) await this.acquire("video").catch(() => undefined);
    this.emit();
  }

  setSpeaker(deviceId: string) {
    this.settings.speakerId = deviceId;
    this.emit();
  }

  /** Noise suppression / echo cancellation toggles, applied live where supported. */
  async setAudioProcessing(
    patch: Partial<Pick<MediaSettings, "noiseSuppression" | "echoCancellation" | "autoGainControl">>,
  ) {
    this.settings = { ...this.settings, ...patch };
    if (!this.audioTrack) return this.emit();
    try {
      await this.audioTrack.applyConstraints(this.audioConstraints());
    } catch {
      await this.acquire("audio").catch(() => undefined);
    }
    this.emit();
  }

  async listDevices(): Promise<DeviceLists> {
    const all = await navigator.mediaDevices.enumerateDevices();
    const named = (d: MediaDeviceInfo) => d.deviceId !== "";
    return {
      microphones: all.filter((d) => d.kind === "audioinput" && named(d)),
      cameras: all.filter((d) => d.kind === "videoinput" && named(d)),
      speakers: all.filter((d) => d.kind === "audiooutput" && named(d)),
    };
  }

  dispose() {
    this.disposed = true;
    this.audioTrack?.stop();
    this.videoTrack?.stop();
    this.audioTrack = null;
    this.videoTrack = null;
    navigator.mediaDevices?.removeEventListener("devicechange", this.onDeviceChange);
    this.listeners.clear();
  }
}

export const supportsSpeakerSelection = () =>
  typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
