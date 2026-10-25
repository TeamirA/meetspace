/**
 * Optional end-to-end encryption of audio/video frames using Encoded Transforms
 * (RTCRtpScriptTransform, or Chrome's legacy createEncodedStreams). Frames are encrypted with
 * AES-GCM in a worker using a media key derived from the meeting's group key, on top of the
 * DTLS-SRTP transport encryption every WebRTC call already has.
 */

type LegacySender = RTCRtpSender & {
  createEncodedStreams?: () => { readable: ReadableStream; writable: WritableStream };
};
type LegacyReceiver = RTCRtpReceiver & {
  createEncodedStreams?: () => { readable: ReadableStream; writable: WritableStream };
};

export function mediaE2EESupport(): "script-transform" | "encoded-streams" | null {
  if (typeof window === "undefined") return null;
  if (typeof (window as { RTCRtpScriptTransform?: unknown }).RTCRtpScriptTransform === "function") {
    return "script-transform";
  }
  if ("createEncodedStreams" in (window.RTCRtpSender?.prototype ?? {})) return "encoded-streams";
  return null;
}

export class MediaE2EE {
  private worker: Worker;
  readonly mode: "script-transform" | "encoded-streams";
  private attached = new WeakSet<object>();

  constructor() {
    const mode = mediaE2EESupport();
    if (!mode) throw new Error("This browser does not support end-to-end encrypted media.");
    this.mode = mode;
    this.worker = new Worker("/e2ee-worker.js", { name: "meetspace-e2ee" });
  }

  get needsInsertableStreamsFlag() {
    return this.mode === "encoded-streams";
  }

  /** Derives a dedicated, non-extractable media key from the group key and hands it to the worker. */
  async setKey(groupKey: CryptoKey, epoch: number) {
    const raw = await crypto.subtle.exportKey("raw", groupKey);
    const hkdf = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]);
    const mediaKey = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(16),
        info: new TextEncoder().encode("meetspace-media-frames"),
      },
      hkdf,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    this.worker.postMessage({ type: "setKey", key: mediaKey, index: epoch % 256 });
  }

  /** VP8's payload header layout is known, so we can leave it in clear for the packetizer. */
  preferVp8(pc: RTCPeerConnection) {
    const caps = RTCRtpReceiver.getCapabilities?.("video");
    if (!caps) return;
    const vp8 = caps.codecs.filter((c) => c.mimeType.toLowerCase() === "video/vp8");
    const rest = caps.codecs.filter((c) => c.mimeType.toLowerCase() !== "video/vp8");
    for (const t of pc.getTransceivers()) {
      if (t.receiver.track?.kind === "video") {
        try {
          t.setCodecPreferences([...vp8, ...rest]);
        } catch {
          // Ignore browsers that don't allow codec preferences here.
        }
      }
    }
  }

  attachSender(sender: RTCRtpSender, kind: "audio" | "video") {
    this.attach(sender, "encode", kind);
  }

  attachReceiver(receiver: RTCRtpReceiver, kind: "audio" | "video") {
    this.attach(receiver, "decode", kind);
  }

  private attach(target: RTCRtpSender | RTCRtpReceiver, operation: "encode" | "decode", kind: "audio" | "video") {
    if (this.attached.has(target)) return;
    this.attached.add(target);
    if (this.mode === "script-transform") {
      target.transform = new RTCRtpScriptTransform(this.worker, { operation, kind });
    } else {
      const streams = (target as LegacySender | LegacyReceiver).createEncodedStreams!();
      this.worker.postMessage({ type: "stream", operation, kind, ...streams }, [streams.readable, streams.writable]);
    }
  }

  dispose() {
    this.worker.terminate();
  }
}
