import { randomBytes, toBase64 } from "./encoding";

/** A meeting's symmetric content key (AES-GCM 256) plus the metadata used to agree on one. */
export interface GroupKey {
  keyId: string;
  /** Bumped on rotation (e.g. after removing someone); the highest epoch wins. */
  epoch: number;
  key: CryptoKey;
}

export async function generateGroupKey(epoch = 0): Promise<GroupKey> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const keyId = `${Date.now().toString(36)}-${toBase64(randomBytes(9)).replace(/[+/=]/g, "x")}`;
  return { keyId, epoch, key };
}

/** True when `candidate` should replace `current` as the meeting's active key. */
export function prefersKey(candidate: Pick<GroupKey, "keyId" | "epoch">, current?: Pick<GroupKey, "keyId" | "epoch">) {
  if (!current) return true;
  if (candidate.epoch !== current.epoch) return candidate.epoch > current.epoch;
  // Same epoch generated concurrently by two people: the earlier (smaller) id wins everywhere.
  return candidate.keyId < current.keyId;
}

/**
 * Human-comparable security code derived from the key. Everyone in the call should see the
 * same digits; reading them aloud detects a man-in-the-middle in the key exchange.
 */
export async function keyFingerprint(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  const groups: string[] = [];
  for (let i = 0; i < 4; i++) {
    const n = ((digest[i * 3] << 16) | (digest[i * 3 + 1] << 8) | digest[i * 3 + 2]) % 100_000;
    groups.push(String(n).padStart(5, "0"));
  }
  return groups.join(" ");
}
