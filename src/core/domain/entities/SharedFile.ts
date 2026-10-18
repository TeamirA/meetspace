export interface SharedFile {
  id: string;
  meetingId: string;
  participantId: string;
  storagePath: string;
  keyId: string;
  iv: string;
  /** AES-GCM encrypted JSON `{ name, type }`, so filenames never reach the server in clear text. */
  encryptedMeta: string;
  metaIv: string;
  sizeBytes: number;
  uploaded: boolean;
  createdAt: Date;
}

export interface FileMeta {
  name: string;
  type: string;
  size: number;
}

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** AES-GCM appends a 16-byte authentication tag to the ciphertext. */
export const GCM_TAG_BYTES = 16;

export function storagePathFor(meetingId: string, fileId: string): string {
  return `${meetingId}/${fileId}.bin`;
}
