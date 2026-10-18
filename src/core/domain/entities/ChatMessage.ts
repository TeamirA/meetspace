/** Server-side view of an end-to-end encrypted chat message: only ciphertext is known. */
export interface ChatMessage {
  id: string;
  meetingId: string;
  participantId: string;
  keyId: string;
  iv: string;
  ciphertext: string;
  createdAt: Date;
}

/** Shape of the plaintext payload inside `ciphertext`, known only to browsers. */
export interface ChatPlaintext {
  text: string;
  senderName: string;
}

export const MAX_CHAT_LENGTH = 4000;
/** base64(AES-GCM(JSON)) of the max plaintext plus envelope overhead. */
export const MAX_CHAT_CIPHERTEXT = 24_000;
