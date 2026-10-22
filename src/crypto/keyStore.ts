import type { GroupKey } from "./groupKey";

/**
 * Persists group keys in IndexedDB (CryptoKey objects are structured-cloneable) so chat and
 * files from a meeting stay readable in history on this device. Keys never leave the browser.
 */
const DB_NAME = "meetspace-keys";
const STORE = "keys";

interface StoredKey extends GroupKey {
  meetingId: string;
  savedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: ["meetingId", "keyId"] });
      store.createIndex("byMeeting", "meetingId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface KeyStore {
  list(meetingId: string): Promise<GroupKey[]>;
  put(meetingId: string, key: GroupKey): Promise<void>;
}

export const indexedDbKeyStore: KeyStore = {
  async list(meetingId) {
    try {
      const db = await open();
      return await new Promise<GroupKey[]>((resolve, reject) => {
        const req = db.transaction(STORE).objectStore(STORE).index("byMeeting").getAll(meetingId);
        req.onsuccess = () =>
          resolve((req.result as StoredKey[]).map(({ keyId, epoch, key }) => ({ keyId, epoch, key })));
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  },
  async put(meetingId, key) {
    try {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put({ ...key, meetingId, savedAt: Date.now() } satisfies StoredKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Private browsing or storage disabled: keys simply live for this session only.
    }
  },
};

export const memoryKeyStore = (): KeyStore => {
  const map = new Map<string, GroupKey[]>();
  return {
    list: async (id) => map.get(id) ?? [],
    put: async (id, key) => {
      map.set(id, [...(map.get(id) ?? []).filter((k) => k.keyId !== key.keyId), key]);
    },
  };
};
