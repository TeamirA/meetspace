import { aad, decryptBytes, decryptJson, encryptBytes, encryptJson } from "./content";
import { generateGroupKey, keyFingerprint, prefersKey, type GroupKey } from "./groupKey";
import { deriveWrappingKey, generateEcdhKeyPair, unwrapGroupKey, wrapGroupKey } from "./keyExchange";
import type { KeyStore } from "./keyStore";

export interface KeyOffer {
  keyId: string;
  epoch: number;
  iv: string;
  wrapped: string;
  senderPublicKey: string;
}

export interface KeyringState {
  ready: boolean;
  keyId: string | null;
  fingerprint: string | null;
}

/**
 * End-to-end encryption keyring for one meeting.
 *
 * Every participant announces an ephemeral ECDH public key. Anyone holding the group key wraps
 * it for newcomers with the pairwise ECDH-derived key and sends it over the room channel. The
 * relay (Supabase) only ever sees public keys and wrapped blobs, never the group key itself.
 */
export class MeetingKeyring {
  private keyPair?: CryptoKeyPair;
  publicKey = "";
  private keys = new Map<string, GroupKey>();
  private current?: GroupKey;
  private listeners = new Set<(s: KeyringState) => void>();
  private fingerprint: string | null = null;

  constructor(
    private readonly meetingId: string,
    private readonly selfId: string,
    private readonly store: KeyStore,
    private readonly sendOffer: (to: string, offer: KeyOffer) => void,
  ) {}

  async init() {
    const { keyPair, publicKey } = await generateEcdhKeyPair();
    this.keyPair = keyPair;
    this.publicKey = publicKey;
    // Resume with the best key from an earlier session on this device so history stays readable;
    // the room converges on one key through the same preference rule used for offers.
    for (const k of await this.store.list(this.meetingId)) {
      this.keys.set(k.keyId, k);
      if (prefersKey(k, this.current)) this.current = k;
    }
    if (this.current) this.fingerprint = await keyFingerprint(this.current.key);
  }

  get state(): KeyringState {
    return { ready: !!this.current, keyId: this.current?.keyId ?? null, fingerprint: this.fingerprint };
  }

  get currentKey() {
    return this.current;
  }

  subscribe(fn: (s: KeyringState) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private async adopt(key: GroupKey) {
    this.keys.set(key.keyId, key);
    await this.store.put(this.meetingId, key);
    if (!prefersKey(key, this.current)) return false;
    this.current = key;
    this.fingerprint = await keyFingerprint(key.key);
    for (const fn of this.listeners) fn(this.state);
    return true;
  }

  /**
   * Called when no one in the room has a key yet. The caller decides who generates (the
   * earliest-joined participant) to avoid everyone creating competing keys at once.
   */
  async createKey() {
    if (this.current) return this.current;
    const key = await generateGroupKey(0);
    await this.adopt(key);
    return key;
  }

  /** Starts a new epoch, e.g. after the host removes someone, then offers it to `peers`. */
  async rotate(peers: { id: string; publicKey: string }[]) {
    const key = await generateGroupKey((this.current?.epoch ?? 0) + 1);
    await this.adopt(key);
    await Promise.all(peers.map((p) => this.offerTo(p.id, p.publicKey)));
  }

  /** Re-offers our current key to a peer whose announced key differs from ours. */
  async offerTo(peerId: string, peerPublicKey: string) {
    if (!this.current || !this.keyPair) return;
    const wrappingKey = await deriveWrappingKey(this.keyPair.privateKey, peerPublicKey, {
      meetingId: this.meetingId,
      a: this.selfId,
      b: peerId,
    });
    const { keyId, epoch } = this.current;
    const { iv, wrapped } = await wrapGroupKey(
      this.current.key,
      wrappingKey,
      aad.keyWrap(this.meetingId, keyId, epoch),
    );
    this.sendOffer(peerId, { keyId, epoch, iv, wrapped, senderPublicKey: this.publicKey });
  }

  /** Should we hand our key to a peer that announced `peerKey`? */
  shouldOffer(peerKey: { keyId: string | null; epoch: number | null }) {
    if (!this.current) return false;
    if (!peerKey.keyId || peerKey.epoch === null) return true;
    return prefersKey(this.current, { keyId: peerKey.keyId, epoch: peerKey.epoch });
  }

  async receiveOffer(fromId: string, offer: KeyOffer): Promise<boolean> {
    if (!this.keyPair) return false;
    if (this.current && !prefersKey(offer, this.current) && this.keys.has(offer.keyId)) return false;
    try {
      const wrappingKey = await deriveWrappingKey(this.keyPair.privateKey, offer.senderPublicKey, {
        meetingId: this.meetingId,
        a: this.selfId,
        b: fromId,
      });
      const key = await unwrapGroupKey(
        offer.wrapped,
        offer.iv,
        wrappingKey,
        aad.keyWrap(this.meetingId, offer.keyId, offer.epoch),
      );
      return this.adopt({ keyId: offer.keyId, epoch: offer.epoch, key });
    } catch {
      return false; // Tampered or mis-addressed offer.
    }
  }

  hasKey(keyId: string) {
    return this.keys.has(keyId);
  }

  private require(keyId?: string): GroupKey {
    const key = keyId ? this.keys.get(keyId) : this.current;
    if (!key) throw new Error("Encryption key not available yet");
    return key;
  }

  async encryptChat(value: unknown) {
    const k = this.require();
    return { keyId: k.keyId, ...(await encryptJson(k.key, value, aad.chat(this.meetingId))) };
  }

  async decryptChat<T>(keyId: string, iv: string, ciphertext: string) {
    return decryptJson<T>(this.require(keyId).key, iv, ciphertext, aad.chat(this.meetingId));
  }

  async encryptFile(fileId: string, data: ArrayBuffer, meta: unknown) {
    const k = this.require();
    const body = await encryptBytes(k.key, data, aad.file(this.meetingId, fileId));
    const metaEnc = await encryptJson(k.key, meta, aad.fileMeta(this.meetingId, fileId));
    return {
      keyId: k.keyId,
      iv: body.iv,
      ciphertext: body.ciphertext,
      metaIv: metaEnc.iv,
      encryptedMeta: metaEnc.ciphertext,
    };
  }

  async decryptFile(fileId: string, keyId: string, iv: string, data: ArrayBuffer) {
    return decryptBytes(this.require(keyId).key, iv, data, aad.file(this.meetingId, fileId));
  }

  async decryptFileMeta<T>(fileId: string, keyId: string, iv: string, encryptedMeta: string) {
    return decryptJson<T>(this.require(keyId).key, iv, encryptedMeta, aad.fileMeta(this.meetingId, fileId));
  }
}

/** Read-only access to stored keys, used by the history page to decrypt past content. */
export async function loadKeyring(meetingId: string, store: KeyStore) {
  const keys = new Map((await store.list(meetingId)).map((k) => [k.keyId, k]));
  return {
    has: (keyId: string) => keys.has(keyId),
    async decryptChat<T>(keyId: string, iv: string, ciphertext: string) {
      const k = keys.get(keyId);
      if (!k) throw new Error("missing key");
      return decryptJson<T>(k.key, iv, ciphertext, aad.chat(meetingId));
    },
    async decryptFileMeta<T>(fileId: string, keyId: string, iv: string, encryptedMeta: string) {
      const k = keys.get(keyId);
      if (!k) throw new Error("missing key");
      return decryptJson<T>(k.key, iv, encryptedMeta, aad.fileMeta(meetingId, fileId));
    },
    async decryptFile(fileId: string, keyId: string, iv: string, data: ArrayBuffer) {
      const k = keys.get(keyId);
      if (!k) throw new Error("missing key");
      return decryptBytes(k.key, iv, data, aad.file(meetingId, fileId));
    },
  };
}
