/* Meetspace E2EE media worker.
 *
 * Frame layout after encryption:
 *   [unencrypted header][AES-GCM ciphertext + tag][12-byte IV][1-byte key index]
 * The header (codec payload descriptor) stays in clear so the RTP packetizer keeps working; it
 * is authenticated as additional data. Frames that fail to decrypt are dropped.
 */
"use strict";

const keys = new Map(); // key index -> CryptoKey
let currentIndex = null;

// VP8 payload header sizes (keyframe vs delta), Opus TOC byte.
function headerBytes(frame, kind) {
  if (kind === "audio") return 1;
  const isKey = frame.type === "key" || (frame.data.byteLength > 0 && (new Uint8Array(frame.data)[0] & 0x01) === 0);
  return isKey ? 10 : 3;
}

async function encode(frame, controller, kind) {
  const key = currentIndex === null ? null : keys.get(currentIndex);
  if (!key) return; // No key yet: send nothing rather than plaintext.
  const data = new Uint8Array(frame.data);
  const h = Math.min(headerBytes(frame, kind), data.length);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: data.subarray(0, h) }, key, data.subarray(h)),
  );
  const out = new Uint8Array(h + ciphertext.length + 13);
  out.set(data.subarray(0, h), 0);
  out.set(ciphertext, h);
  out.set(iv, h + ciphertext.length);
  out[out.length - 1] = currentIndex;
  frame.data = out.buffer;
  controller.enqueue(frame);
}

async function decode(frame, controller, kind) {
  const data = new Uint8Array(frame.data);
  if (data.length < 14) return;
  const key = keys.get(data[data.length - 1]);
  if (!key) return;
  const h = Math.min(headerBytes(frame, kind), data.length - 13);
  const iv = data.subarray(data.length - 13, data.length - 1);
  try {
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: data.subarray(0, h) },
        key,
        data.subarray(h, data.length - 13),
      ),
    );
    const out = new Uint8Array(h + plain.length);
    out.set(data.subarray(0, h), 0);
    out.set(plain, h);
    frame.data = out.buffer;
    controller.enqueue(frame);
  } catch {
    // Wrong key or tampered frame: drop it.
  }
}

function pipe(readable, writable, operation, kind) {
  const transform = new TransformStream({
    transform: (frame, controller) =>
      operation === "encode" ? encode(frame, controller, kind) : decode(frame, controller, kind),
  });
  readable.pipeThrough(transform).pipeTo(writable).catch(() => {});
}

// RTCRtpScriptTransform (Safari, Firefox, recent Chrome)
self.addEventListener("rtctransform", (event) => {
  const { readable, writable, options } = event.transformer;
  pipe(readable, writable, options.operation, options.kind);
});

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg.type === "setKey") {
    keys.set(msg.index, msg.key);
    currentIndex = msg.index;
  } else if (msg.type === "stream") {
    // Legacy Chrome createEncodedStreams
    pipe(msg.readable, msg.writable, msg.operation, msg.kind);
  }
});
