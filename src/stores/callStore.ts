"use client";

import { create } from "zustand";
import type { MeetingDto, ParticipantDto } from "@/core/application/dtos";
import type { ConnectionQuality } from "@/media/ConnectionStatsMonitor";
import type { ConnectionStatus } from "@/media/SignalingClient";

export interface RemoteParticipant {
  id: string;
  sessionId: string;
  displayName: string;
  role: "HOST" | "PARTICIPANT" | "GUEST";
  joinedAt: number;
  mic: boolean;
  cam: boolean;
  cameraStreamId: string;
  screenStreamId: string | null;
  handRaisedAt: number | null;
  connection: RTCPeerConnectionState | "new";
  quality: ConnectionQuality;
  /** Bumped when remote tracks change so tiles re-attach media elements. */
  mediaVersion: number;
}

export interface ChatItem {
  id: string;
  participantId: string;
  senderName: string;
  text: string;
  createdAt: number;
  status: "sent" | "pending" | "failed" | "locked";
}

export interface FileItem {
  id: string;
  participantId: string;
  senderName: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  status: "uploading" | "ready" | "failed" | "locked" | "downloading";
  progress: number;
}

export interface Reaction {
  id: string;
  emoji: string;
  participantId: string;
  name: string;
}

export type CallPhase = "idle" | "connecting" | "connected" | "ended" | "removed" | "error";

export interface CallState {
  phase: CallPhase;
  endReason: string | null;
  signaling: ConnectionStatus;
  online: boolean;
  meeting: MeetingDto | null;
  self: {
    id: string;
    sessionId: string;
    displayName: string;
    role: RemoteParticipant["role"];
    joinedAt: number;
  } | null;
  hostId: string | null;
  participants: Record<string, RemoteParticipant>;
  local: {
    mic: boolean;
    cam: boolean;
    screen: boolean;
    handRaisedAt: number | null;
    recording: boolean;
    captions: boolean;
    /** Changes when the camera track is swapped (device switch), so the self tile re-binds. */
    videoTrackId: string | null;
  };
  activeSpeakerId: string | null;
  waiting: ParticipantDto[];
  messages: ChatItem[];
  unread: number;
  files: FileItem[];
  reactions: Reaction[];
  captions: Record<string, { name: string; text: string; at: number }>;
  security: { ready: boolean; fingerprint: string | null; mediaE2EE: boolean };
  locked: boolean;
}

const initial: CallState = {
  phase: "idle",
  endReason: null,
  signaling: "connecting",
  online: true,
  meeting: null,
  self: null,
  hostId: null,
  participants: {},
  local: {
    mic: true,
    cam: true,
    screen: false,
    handRaisedAt: null,
    recording: false,
    captions: false,
    videoTrackId: null,
  },
  activeSpeakerId: null,
  waiting: [],
  messages: [],
  unread: 0,
  files: [],
  reactions: [],
  captions: {},
  security: { ready: false, fingerprint: null, mediaE2EE: false },
  locked: false,
};

export const useCallStore = create<CallState>()(() => ({ ...initial }));

export const callStore = {
  get: useCallStore.getState,
  set: useCallStore.setState,
  reset: () => useCallStore.setState({ ...initial }, true),
  patchParticipant(id: string, patch: Partial<RemoteParticipant>) {
    useCallStore.setState((s) => {
      const p = s.participants[id];
      if (!p) return s;
      return { participants: { ...s.participants, [id]: { ...p, ...patch } } };
    });
  },
  upsertMessage(item: ChatItem) {
    useCallStore.setState((s) => {
      const idx = s.messages.findIndex((m) => m.id === item.id);
      const messages =
        idx === -1 ? [...s.messages, item].sort((a, b) => a.createdAt - b.createdAt) : s.messages.with(idx, item);
      return { messages };
    });
  },
  upsertFile(item: Partial<FileItem> & { id: string }) {
    useCallStore.setState((s) => {
      const idx = s.files.findIndex((f) => f.id === item.id);
      if (idx === -1) return { files: [...s.files, item as FileItem] };
      return { files: s.files.with(idx, { ...s.files[idx], ...item }) };
    });
  },
};
