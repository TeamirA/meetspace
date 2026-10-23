import { MAX_CHAT_LENGTH } from "@/core/domain/entities/ChatMessage";

/**
 * Chat text arrives decrypted from other browsers, so it is untrusted. We never inject it as
 * HTML: React escapes text nodes, and links are built as elements from this tokenizer.
 * This strips control/bidi-override characters and caps the length.
 */
export function sanitizeChatText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
    .slice(0, MAX_CHAT_LENGTH)
    .trim();
}

export type ChatToken = { kind: "text"; value: string } | { kind: "link"; value: string; href: string };

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/** Splits text into plain and link tokens. Only http(s) URLs become links. */
export function tokenizeChatText(text: string): ChatToken[] {
  const tokens: ChatToken[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) tokens.push({ kind: "text", value: text.slice(last, start) });
    try {
      const url = new URL(match[0]);
      if (url.protocol === "http:" || url.protocol === "https:") {
        tokens.push({ kind: "link", value: match[0], href: url.href });
      } else {
        tokens.push({ kind: "text", value: match[0] });
      }
    } catch {
      tokens.push({ kind: "text", value: match[0] });
    }
    last = start + match[0].length;
  }
  if (last < text.length) tokens.push({ kind: "text", value: text.slice(last) });
  return tokens;
}

export function sanitizeDisplayName(input: unknown, fallback = "Guest"): string {
  if (typeof input !== "string") return fallback;
  const clean = input
    .replace(/[<>\u0000-\u001f\u202A-\u202E\u2066-\u2069]/g, "")
    .trim()
    .slice(0, 60);
  return clean || fallback;
}
