import { fromBase64, randomBytes, toBase64, utf8 } from "./encoding";

/** AES-GCM with a fresh 96-bit IV per message; the meeting id is bound as associated data. */
export async function encryptJson(key: CryptoKey, value: unknown, aad: string) {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: utf8.encode(aad) },
    key,
    utf8.encode(JSON.stringify(value)),
  );
  return { iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}

export async function decryptJson<T>(key: CryptoKey, iv: string, ciphertext: string, aad: string): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv), additionalData: utf8.encode(aad) },
    key,
    fromBase64(ciphertext),
  );
  return JSON.parse(utf8.decode(plain)) as T;
}

export async function encryptBytes(key: CryptoKey, data: ArrayBuffer, aad: string) {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: utf8.encode(aad) }, key, data);
  return { iv: toBase64(iv), ciphertext };
}

export async function decryptBytes(key: CryptoKey, iv: string, data: ArrayBuffer, aad: string) {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv), additionalData: utf8.encode(aad) }, key, data);
}

/** Associated data strings, so a ciphertext can't be moved between meetings or content types. */
export const aad = {
  chat: (meetingId: string) => `chat:${meetingId}`,
  file: (meetingId: string, fileId: string) => `file:${meetingId}:${fileId}`,
  fileMeta: (meetingId: string, fileId: string) => `file-meta:${meetingId}:${fileId}`,
  keyWrap: (meetingId: string, keyId: string, epoch: number) => `key:${meetingId}:${keyId}:${epoch}`,
};
