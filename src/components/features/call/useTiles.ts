"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { ConnectionQuality } from "@/media/ConnectionStatsMonitor";
import { useCallStore } from "@/stores/callStore";

export interface TileModel {
  key: string;
  participantId: string;
  kind: "camera" | "screen";
  isSelf: boolean;
  name: string;
  role: "HOST" | "PARTICIPANT" | "GUEST";
  mic: boolean;
  cam: boolean;
  handRaisedAt: number | null;
  quality: ConnectionQuality;
  connection: string;
  mediaVersion: number;
}

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
};

/** Flattens self + remote participants (+ their screen shares) into renderable tiles. */
export function useTiles(): TileModel[] {
  const { self, local, participants } = useCallStore(
    useShallow((s) => ({ self: s.self, local: s.local, participants: s.participants })),
  );
  return useMemo(() => {
    if (!self) return [];
    const tiles: TileModel[] = [];
    const selfTile: TileModel = {
      key: `${self.id}:camera`,
      participantId: self.id,
      kind: "camera",
      isSelf: true,
      name: self.displayName,
      role: self.role,
      mic: local.mic,
      cam: local.cam,
      handRaisedAt: local.handRaisedAt,
      quality: "good",
      connection: "connected",
      mediaVersion: hash(local.videoTrackId ?? ""),
    };
    if (local.screen) tiles.push({ ...selfTile, key: `${self.id}:screen`, kind: "screen" });
    const remotes = Object.values(participants).sort((a, b) => a.joinedAt - b.joinedAt);
    for (const p of remotes) {
      if (p.screenStreamId) {
        tiles.push({
          key: `${p.id}:screen`,
          participantId: p.id,
          kind: "screen",
          isSelf: false,
          name: p.displayName,
          role: p.role,
          mic: p.mic,
          cam: true,
          handRaisedAt: null,
          quality: p.quality,
          connection: p.connection,
          mediaVersion: p.mediaVersion,
        });
      }
    }
    tiles.push(selfTile);
    for (const p of remotes) {
      tiles.push({
        key: `${p.id}:camera`,
        participantId: p.id,
        kind: "camera",
        isSelf: false,
        name: p.displayName,
        role: p.role,
        mic: p.mic,
        cam: p.cam,
        handRaisedAt: p.handRaisedAt,
        quality: p.quality,
        connection: p.connection,
        mediaVersion: p.mediaVersion,
      });
    }
    return tiles;
  }, [self, local, participants]);
}
