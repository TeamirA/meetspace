import { describe, expect, it } from "vitest";
import { aad, decryptJson, encryptJson } from "@/crypto/content";
import { fromBase64, toBase64 } from "@/crypto/encoding";
import { generateGroupKey, keyFingerprint, prefersKey } from "@/crypto/groupKey";
import { memoryKeyStore } from "@/crypto/keyStore";
import { MeetingKeyring, type KeyOffer } from "@/crypto/MeetingKeyring";

async function pair() {
  const outbox: { from: string; to: string; offer: KeyOffer }[] = [];
  const alice = new MeetingKeyring("m1", "alice", memoryKeyStore(), (to, offer) =>
    outbox.push({ from: "alice", to, offer }),
  );
  const bob = new MeetingKeyring("m1", "bob", memoryKeyStore(), (to, offer) => outbox.push({ from: "bob", to, offer }));
  await alice.init();
  await bob.init();
  return { alice, bob, outbox };
}

describe("encoding", () => {
  it("round-trips base64", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(60_000));
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});

describe("group key exchange (ECDH + AES-GCM)", () => {
  it("lets a newcomer receive the group key and read messages", async () => {
    const { alice, bob, outbox } = await pair();
    await alice.createKey();
    await alice.offerTo("bob", bob.publicKey);
    expect(outbox).toHaveLength(1);
    expect(await bob.receiveOffer("alice", outbox[0].offer)).toBe(true);

    expect(bob.state.keyId).toBe(alice.state.keyId);
    expect(bob.state.fingerprint).toBe(alice.state.fingerprint);

    const enc = await alice.encryptChat({ text: "hello", senderName: "Alice" });
    expect(enc.ciphertext).not.toContain("hello");
    await expect(bob.decryptChat(enc.keyId, enc.iv, enc.ciphertext)).resolves.toEqual({
      text: "hello",
      senderName: "Alice",
    });
  });

  it("rejects an offer that was addressed to someone else", async () => {
    const { alice, outbox } = await pair();
    const mallory = new MeetingKeyring("m1", "mallory", memoryKeyStore(), () => undefined);
    await mallory.init();
    await alice.createKey();
    await alice.offerTo("bob", mallory.publicKey); // wrapped for the bob/alice pair id
    expect(await mallory.receiveOffer("alice", outbox[0].offer)).toBe(false);
  });

  it("rejects a tampered wrapped key", async () => {
    const { alice, bob, outbox } = await pair();
    await alice.createKey();
    await alice.offerTo("bob", bob.publicKey);
    const bad = { ...outbox[0].offer, wrapped: toBase64(crypto.getRandomValues(new Uint8Array(48))) };
    expect(await bob.receiveOffer("alice", bad)).toBe(false);
    expect(bob.state.ready).toBe(false);
  });

  it("encrypts and decrypts files and their metadata", async () => {
    const { alice, bob, outbox } = await pair();
    await alice.createKey();
    await alice.offerTo("bob", bob.publicKey);
    await bob.receiveOffer("alice", outbox[0].offer);
    const data = crypto.getRandomValues(new Uint8Array(4096)).buffer;
    const enc = await alice.encryptFile("f1", data, { name: "plan.pdf", type: "application/pdf", size: 4096 });
    expect(enc.ciphertext.byteLength).toBe(4096 + 16);
    const plain = await bob.decryptFile("f1", enc.keyId, enc.iv, enc.ciphertext);
    expect(new Uint8Array(plain)).toEqual(new Uint8Array(data));
    await expect(bob.decryptFileMeta("f1", enc.keyId, enc.metaIv, enc.encryptedMeta)).resolves.toMatchObject({
      name: "plan.pdf",
    });
    // Ciphertext is bound to its file id.
    await expect(bob.decryptFile("other", enc.keyId, enc.iv, enc.ciphertext)).rejects.toThrow();
  });

  it("rotates to a new epoch that everyone prefers", async () => {
    const { alice, bob, outbox } = await pair();
    await alice.createKey();
    const firstKey = alice.state.keyId;
    await alice.rotate([{ id: "bob", publicKey: bob.publicKey }]);
    expect(alice.currentKey!.epoch).toBe(1);
    await bob.receiveOffer("alice", outbox.at(-1)!.offer);
    expect(bob.state.keyId).toBe(alice.state.keyId);
    expect(bob.state.keyId).not.toBe(firstKey);
  });
});

describe("key preference", () => {
  it("prefers higher epochs, then smaller ids", () => {
    expect(prefersKey({ keyId: "b", epoch: 1 }, { keyId: "a", epoch: 0 })).toBe(true);
    expect(prefersKey({ keyId: "a", epoch: 0 }, { keyId: "b", epoch: 0 })).toBe(true);
    expect(prefersKey({ keyId: "b", epoch: 0 }, { keyId: "a", epoch: 0 })).toBe(false);
  });

  it("derives the same fingerprint for the same key", async () => {
    const k = await generateGroupKey();
    expect(await keyFingerprint(k.key)).toMatch(/^\d{5} \d{5} \d{5} \d{5}$/);
    expect(await keyFingerprint(k.key)).toBe(await keyFingerprint(k.key));
  });

  it("binds ciphertext to its associated data", async () => {
    const k = await generateGroupKey();
    const enc = await encryptJson(k.key, { a: 1 }, aad.chat("m1"));
    await expect(decryptJson(k.key, enc.iv, enc.ciphertext, aad.chat("m2"))).rejects.toThrow();
  });
});
