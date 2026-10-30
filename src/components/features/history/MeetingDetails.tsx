"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Crown, Download, Lock, MessageSquare, Users } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileTypeIcon } from "@/components/features/files/fileIcon";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/misc";
import type { ChatMessageDto, MeetingDto, ParticipantDto, SharedFileDto } from "@/core/application/dtos";
import type { ChatPlaintext } from "@/core/domain/entities/ChatMessage";
import type { FileMeta } from "@/core/domain/entities/SharedFile";
import type { BoardElement } from "@/core/domain/entities/Whiteboard";
import { loadKeyring } from "@/crypto/MeetingKeyring";
import { indexedDbKeyStore } from "@/crypto/keyStore";
import { api } from "@/lib/api-client";
import { sanitizeChatText, sanitizeDisplayName } from "@/lib/sanitize";
import { formatBytes, formatDuration } from "@/lib/utils";
import { saveBlob } from "@/media/CallSession";

const ReadOnlyBoard = dynamic(
  () => import("@/components/features/whiteboard/ReadOnlyBoard").then((m) => m.ReadOnlyBoard),
  {
    ssr: false,
    loading: () => <Skeleton className="aspect-video" />,
  },
);

interface Details {
  meeting: MeetingDto;
  durationMs: number | null;
  myParticipantId: string | null;
  participants: ParticipantDto[];
  files: SharedFileDto[];
  whiteboard: { elements: BoardElement[]; updatedAt: string } | null;
}

type Keyring = Awaited<ReturnType<typeof loadKeyring>>;

export function MeetingDetails({ code }: { code: string }) {
  const q = useQuery({
    queryKey: ["meeting-details", code],
    queryFn: () => api<Details>(`/api/meetings/${code}/details`),
  });
  const chat = useQuery({
    queryKey: ["meeting-chat", code],
    queryFn: () => api<{ items: ChatMessageDto[] }>(`/api/meetings/${code}/messages`).then((r) => r.items),
    retry: false,
  });
  const [keyring, setKeyring] = useState<Keyring | null>(null);
  const [fileMeta, setFileMeta] = useState<Record<string, FileMeta | null>>({});
  const [messages, setMessages] = useState<
    { id: string; name: string; text: string | null; at: string; pid: string }[]
  >([]);

  const meetingId = q.data?.meeting.id;
  useEffect(() => {
    if (meetingId) void loadKeyring(meetingId, indexedDbKeyStore).then(setKeyring);
  }, [meetingId]);

  useEffect(() => {
    if (!keyring || !q.data) return;
    void Promise.all(
      q.data.files.map(async (f) => {
        try {
          return [f.id, await keyring.decryptFileMeta<FileMeta>(f.id, f.keyId, f.metaIv, f.encryptedMeta)] as const;
        } catch {
          return [f.id, null] as const;
        }
      }),
    ).then((entries) => setFileMeta(Object.fromEntries(entries)));
  }, [keyring, q.data]);

  useEffect(() => {
    if (!keyring || !chat.data || !q.data) return;
    const names = new Map(q.data.participants.map((p) => [p.id, p.displayName]));
    void Promise.all(
      chat.data.map(async (m) => {
        try {
          const plain = await keyring.decryptChat<ChatPlaintext>(m.keyId, m.iv, m.ciphertext);
          return {
            id: m.id,
            pid: m.participantId,
            name: sanitizeDisplayName(plain.senderName, names.get(m.participantId) ?? "Participant"),
            text: sanitizeChatText(plain.text),
            at: m.createdAt,
          };
        } catch {
          return {
            id: m.id,
            pid: m.participantId,
            name: names.get(m.participantId) ?? "Participant",
            text: null,
            at: m.createdAt,
          };
        }
      }),
    ).then(setMessages);
  }, [keyring, chat.data, q.data]);

  const download = async (f: SharedFileDto) => {
    const meta = fileMeta[f.id];
    if (!keyring || !meta) return;
    try {
      const { url } = await api<{ url: string }>(`/api/meetings/${code}/files/${f.id}`);
      const res = await fetch(url);
      const plain = await keyring.decryptFile(f.id, f.keyId, f.iv, await res.arrayBuffer());
      saveBlob(new Blob([plain], { type: meta.type }), meta.name);
    } catch {
      toast.error("Couldn't download this file");
    }
  };

  if (q.isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64" />
      </div>
    );
  if (q.isError) {
    return (
      <Card>
        <EmptyState
          icon={<Lock />}
          title="You can't view this meeting"
          description="Only people who took part can see its history."
          action={
            <Button asChild variant="outline">
              <Link href="/history">Back to history</Link>
            </Button>
          }
        />
      </Card>
    );
  }
  const { meeting, participants, files, whiteboard, durationMs } = q.data;
  const locked = messages.some((m) => m.text === null) || Object.values(fileMeta).some((v) => v === null);

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-3">
          <Link href="/history">
            <ArrowLeft /> History
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">{meeting.title}</h1>
        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {meeting.startedAt && (
            <span>
              {new Date(meeting.startedAt).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
            </span>
          )}
          {durationMs !== null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4" /> {formatDuration(durationMs)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="size-4" /> {participants.length} participants
          </span>
          <span className="font-mono">{meeting.code}</span>
        </div>
        {locked && (
          <p className="bg-muted text-muted-foreground mt-4 flex items-start gap-2 rounded-xl p-3 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0" /> Some content was encrypted with a key that isn&apos;t stored on
            this device, so it can&apos;t be shown here.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section aria-labelledby="board-h">
            <h2 id="board-h" className="mb-3 font-semibold">
              Whiteboard
            </h2>
            <ReadOnlyBoard elements={whiteboard?.elements ?? []} filename={`whiteboard-${meeting.code}.png`} />
          </section>
          <section aria-labelledby="chat-h">
            <h2 id="chat-h" className="mb-3 font-semibold">
              Chat
            </h2>
            <Card className="max-h-[480px] scrollbar-thin overflow-y-auto p-4">
              {chat.isPending ? (
                <Skeleton className="h-24" />
              ) : messages.length === 0 ? (
                <EmptyState icon={<MessageSquare />} title="No messages" className="py-6" />
              ) : (
                <ul className="space-y-3">
                  {messages.map((m) => (
                    <li key={m.id} className="flex gap-3">
                      <Avatar name={m.name} size={30} />
                      <div className="min-w-0">
                        <div className="text-xs">
                          <span className="font-medium">{m.name}</span>{" "}
                          <span className="text-muted-foreground">
                            {new Date(m.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        {m.text === null ? (
                          <p className="text-muted-foreground text-sm italic">Encrypted message</p>
                        ) : (
                          <p className="text-sm break-words whitespace-pre-wrap">{m.text}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
        <aside className="space-y-6">
          <section aria-labelledby="people-h">
            <h2 id="people-h" className="mb-3 font-semibold">
              Participants
            </h2>
            <Card className="divide-y">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3">
                  <Avatar name={p.displayName} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.displayName}</span>
                  {p.role === "HOST" && (
                    <Badge tone="warning">
                      <Crown className="size-3" /> Host
                    </Badge>
                  )}
                  {p.role === "GUEST" && <Badge>Guest</Badge>}
                </div>
              ))}
            </Card>
          </section>
          <section aria-labelledby="files-h">
            <h2 id="files-h" className="mb-3 font-semibold">
              Shared files
            </h2>
            <Card className="divide-y">
              {files.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">No files were shared.</p>
              ) : (
                files.map((f) => {
                  const meta = fileMeta[f.id];
                  return (
                    <div key={f.id} className="flex items-center gap-3 p-3">
                      <div className="bg-primary-soft text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                        {meta ? (
                          <FileTypeIcon type={meta.type} name={meta.name} className="size-4" />
                        ) : (
                          <Lock className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{meta?.name ?? "Encrypted file"}</div>
                        <div className="text-muted-foreground text-xs">{formatBytes(meta?.size ?? f.sizeBytes)}</div>
                      </div>
                      {meta && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Download ${meta.name}`}
                          onClick={() => void download(f)}
                        >
                          <Download />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </Card>
          </section>
        </aside>
      </div>
    </div>
  );
}
