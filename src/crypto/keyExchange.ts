import { fromBase64, randomBytes, toBase64, utf8 } from "./encoding";

/**
 * ECDH (P-256) key agreement used to hand the meeting's group key to each new participant.
 * Private keys are generated per session and are never extractable.
 */
export async function generateEcdhKeyPair(): Promise<{ keyPair: CryptoKeyPair; publicKey: string }> {
  const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const raw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  return { keyPair, publicKey: toBase64(raw) };
}

export async function importPeerPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromBase64(publicKeyB64), { name: "ECDH", namedCurve: "P-256" }, false, []);
}

/**
 * Derives a pairwise AES-GCM wrapping key: ECDH shared secret → HKDF-SHA-256, bound to the
 * meeting and both participant ids so a wrapped key can't be replayed into another context.
 */
export async function deriveWrappingKey(
  privateKey: CryptoKey,
  peerPublicKeyB64: string,
  context: { meetingId: string; a: string; b: string },
): Promise<CryptoKey> {
  const peerKey = await importPeerPublicKey(peerPublicKeyB64);
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: peerKey }, privateKey, 256);
  const hkdfKey = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const [x, y] = [context.a, context.b].sort();
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: utf8.encode(`meetspace:${context.meetingId}`),
      info: utf8.encode(`group-key-wrap:${x}:${y}`),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

export async function wrapGroupKey(groupKey: CryptoKey, wrappingKey: CryptoKey, aad: string) {
  const iv = randomBytes(12);
  const wrapped = await crypto.subtle.wrapKey("raw", groupKey, wrappingKey, {
    name: "AES-GCM",
    iv,
    additionalData: utf8.encode(aad),
  });
  return { iv: toBase64(iv), wrapped: toBase64(wrapped) };
}

export async function unwrapGroupKey(
  wrapped: string,
  iv: string,
  wrappingKey: CryptoKey,
  aad: string,
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    "raw",
    fromBase64(wrapped),
    wrappingKey,
    { name: "AES-GCM", iv: fromBase64(iv), additionalData: utf8.encode(aad) },
    { name: "AES-GCM", length: 256 },
    // Extractable so this participant can pass the key on to people who join later.
    true,
    ["encrypt", "decrypt"],
  );
}
