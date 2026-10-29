"use client";

import { AlertCircle, Lock, Paperclip, Send, Smile } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/misc";
import { useCallSession } from "@/components/features/call/context";
import { tokenizeChatText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { useCallStore, type ChatItem } from "@/stores/callStore";
import { FileDropZone } from "@/components/features/files/FileDropZone";

const EMOJI = [
  "😀",
  "😂",
  "😍",
  "🥳",
  "😎",
  "🤔",
  "😅",
  "😢",
  "👍",
  "👎",
  "👏",
  "🙏",
  "🔥",
  "🎉",
  "❤️",
  "✅",
  "👀",
  "💡",
  "🚀",
  "☕",
];

function MessageText({ text }: { text: string }) {
  return (
    <p className="text-sm break-words whitespace-pre-wrap">
      {tokenizeChatText(text).map((t, i) =>
        t.kind === "link" ? (
          <a
            key={i}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline underline-offset-2"
          >
            {t.value}
          </a>
        ) : (
          <span key={i}>{t.value}</span>
        ),
      )}
    </p>
  );
}

function Message({ m, mine, grouped }: { m: ChatItem; mine: boolean; grouped: boolean }) {
  const time = new Date(m.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (
    <li className={cn("flex gap-2.5", mine && "flex-row-reverse", grouped ? "mt-1" : "mt-4")}>
      <div className="w-8 shrink-0">{!grouped && !mine && <Avatar name={m.senderName} size={32} />}</div>
      <div className={cn("max-w-[78%] min-w-0", mine && "items-end text-right")}>
        {!grouped && (
          <div className={cn("mb-1 flex items-baseline gap-2 text-xs", mine && "flex-row-reverse")}>
            <span className="font-medium">{mine ? "You" : m.senderName}</span>
            <time className="text-muted-foreground" dateTime={new Date(m.createdAt).toISOString()}>
              {time}
            </time>
          </div>
        )}
        <div
          className={cn(
            "inline-block rounded-2xl px-3.5 py-2 text-left",
            mine ? "bg-primary text-primary-foreground rounded-tr-md" : "bg-muted rounded-tl-md",
            m.status === "pending" && "opacity-60",
          )}
        >
          {m.status === "locked" ? (
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm italic">
              <Lock className="size-3.5" /> Encrypted with a key this device doesn&apos;t have
            </span>
          ) : (
            <MessageText text={m.text} />
          )}
        </div>
        {m.status === "failed" && (
          <div className="text-destructive mt-1 flex items-center justify-end gap-1 text-xs">
            <AlertCircle className="size-3" /> Not delivered
          </div>
        )}
      </div>
    </li>
  );
}

export function ChatPanel() {
  const session = useCallSession();
  const messages = useCallStore((s) => s.messages);
  const selfId = useCallStore((s) => s.self?.id);
  const ready = useCallStore((s) => s.security.ready);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    session.markChatRead();
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, session]);

  const send = () => {
    if (!text.trim()) return;
    void session.sendChat(text);
    setText("");
    inputRef.current?.focus();
  };

  return (
    <FileDropZone
      onFiles={(files) => files.forEach((f) => void session.shareFile(f))}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        ref={listRef}
        className="min-h-0 flex-1 scrollbar-thin overflow-y-auto px-4 pb-4"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.length === 0 ? (
          <EmptyState
            icon={<Lock />}
            title="Messages are end-to-end encrypted"
            description="Only people in this meeting can read them. Drop a file here to share it."
            className="h-full"
          />
        ) : (
          <ul>
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const grouped =
                !!prev && prev.participantId === m.participantId && m.createdAt - prev.createdAt < 120_000;
              return <Message key={m.id} m={m} mine={m.participantId === selfId} grouped={grouped} />;
            })}
          </ul>
        )}
      </div>
      <div className="border-t p-3">
        <div className="bg-background/60 focus-within:border-ring focus-within:ring-ring/15 flex items-end gap-1.5 rounded-2xl border p-1.5 focus-within:ring-4">
          <Popover.Root>
            <Popover.Trigger
              aria-label="Insert emoji"
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-xl"
            >
              <Smile className="size-5" />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="top"
                align="start"
                sideOffset={8}
                className="bg-popover shadow-float z-50 grid grid-cols-5 gap-1 rounded-2xl border p-2"
              >
                {EMOJI.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-label={`Insert ${e}`}
                    className="hover:bg-muted flex size-9 items-center justify-center rounded-lg text-xl"
                    onClick={() => setText((t) => t + e)}
                  >
                    {e}
                  </button>
                ))}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={ready ? "Send a message" : "Setting up encryption…"}
            aria-label="Message"
            className="placeholder:text-muted-foreground/70 max-h-32 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none"
          />
          <button
            type="button"
            aria-label="Attach a file"
            onClick={() => fileInput.current?.click()}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-xl"
          >
            <Paperclip className="size-5" />
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!text.trim()}
            aria-label="Send message"
            className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              Array.from(e.target.files ?? []).forEach((f) => void session.shareFile(f));
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </FileDropZone>
  );
}
