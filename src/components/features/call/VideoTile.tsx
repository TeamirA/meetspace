"use client";

import { Crown, Hand, Loader2, MicOff, MonitorUp, PictureInPicture2, Pin, PinOff, Signal } from "lucide-react";
import { motion } from "motion/react";
import { memo, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useMediaStream } from "@/hooks/useMediaStream";
import { cn } from "@/lib/utils";
import { useCallStore } from "@/stores/callStore";
import { useUiStore } from "@/stores/uiStore";
import { useCallSession } from "./context";
import type { TileModel } from "./useTiles";

const qualityStyles = {
  good: { bars: 3, className: "text-success", label: "Good connection" },
  fair: { bars: 2, className: "text-warning", label: "Fair connection" },
  poor: { bars: 1, className: "text-destructive", label: "Poor connection" },
  unknown: { bars: 0, className: "text-muted-foreground", label: "Measuring connection" },
} as const;

function QualityIndicator({ quality }: { quality: TileModel["quality"] }) {
  const q = qualityStyles[quality];
  return (
    <span className={cn("flex items-end gap-0.5", q.className)} role="img" aria-label={q.label} title={q.label}>
      {[1, 2, 3].map((b) => (
        <span
          key={b}
          className={cn("w-[3px] rounded-full bg-current", b > q.bars && "opacity-30")}
          style={{ height: 4 + b * 3 }}
        />
      ))}
    </span>
  );
}

function useHasLiveVideo(stream: MediaStream | undefined, version: number) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    const track = stream?.getVideoTracks()[0];
    const update = () => setLive(!!track && track.readyState === "live" && !track.muted);
    update();
    if (!track) return;
    track.addEventListener("mute", update);
    track.addEventListener("unmute", update);
    track.addEventListener("ended", update);
    return () => {
      track.removeEventListener("mute", update);
      track.removeEventListener("unmute", update);
      track.removeEventListener("ended", update);
    };
  }, [stream, version]);
  return live;
}

export const VideoTile = memo(function VideoTile({
  tile,
  className,
  compact,
}: {
  tile: TileModel;
  className?: string;
  compact?: boolean;
}) {
  const session = useCallSession();
  const isSpeaking = useCallStore(
    (s) => s.activeSpeakerId === tile.participantId && tile.kind === "camera" && tile.mic,
  );
  const pinnedId = useUiStore((s) => s.pinnedId);
  const pin = useUiStore((s) => s.pin);
  const stream = session.getStream(tile.participantId, tile.kind);
  const liveVideo = useHasLiveVideo(stream, tile.mediaVersion);
  const showVideo = tile.kind === "screen" || (tile.cam && liveVideo);
  const ref = useMediaStream<HTMLVideoElement>(stream, tile.mediaVersion);
  const reconnecting =
    !tile.isSelf &&
    (tile.connection === "connecting" || tile.connection === "disconnected" || tile.connection === "new");
  const failed = !tile.isSelf && tile.connection === "failed";
  const label =
    tile.kind === "screen"
      ? `${tile.isSelf ? "Your" : `${tile.name}'s`} screen`
      : tile.isSelf
        ? `${tile.name} (You)`
        : tile.name;
  const isPinned = pinnedId === tile.key;

  const pip = async () => {
    const el = ref.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement === el) await document.exitPictureInPicture();
      else await el.requestPictureInPicture();
    } catch {
      // PiP not allowed for this element/browser.
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "group bg-tile relative isolate flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-2xl",
        isSpeaking && "ring-primary shadow-[0_0_24px_-4px_var(--primary)] ring-[3px]",
        className,
      )}
      role="group"
      aria-label={label}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={cn(
          "absolute inset-0 size-full transition-opacity duration-300",
          tile.kind === "screen" ? "object-contain" : "object-cover",
          tile.isSelf && tile.kind === "camera" && "mirror",
          showVideo ? "opacity-100" : "opacity-0",
        )}
      />
      {!showVideo && (
        <div className="flex flex-col items-center gap-2">
          <Avatar name={tile.name} size={compact ? 44 : 76} className={cn(isSpeaking && "animate-pulse-ring")} />
        </div>
      )}

      {(reconnecting || failed) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white backdrop-blur-sm">
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            {failed ? "Reconnecting…" : "Connecting…"}
          </span>
        </div>
      )}

      {tile.handRaisedAt && tile.kind === "camera" && (
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          className="bg-warning shadow-soft absolute top-2.5 left-2.5 flex size-8 items-center justify-center rounded-full text-black"
          aria-label="Hand raised"
        >
          <Hand className="size-4" />
        </motion.div>
      )}

      <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={() => pin(tile.key)}
          aria-label={isPinned ? `Unpin ${label}` : `Pin ${label}`}
          className="glass flex size-8 items-center justify-center rounded-lg"
        >
          {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </button>
        {showVideo && typeof document !== "undefined" && document.pictureInPictureEnabled && (
          <button
            type="button"
            onClick={pip}
            aria-label={`Picture-in-picture for ${label}`}
            className="glass flex size-8 items-center justify-center rounded-lg"
          >
            <PictureInPicture2 className="size-4" />
          </button>
        )}
      </div>

      <div className="absolute right-2 bottom-2 left-2 flex items-center justify-between gap-2">
        <div className="glass flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium">
          {tile.kind === "screen" ? (
            <MonitorUp className="text-primary size-3.5 shrink-0" />
          ) : !tile.mic ? (
            <MicOff className="size-3.5 shrink-0 text-red-400" aria-label="Muted" />
          ) : null}
          {tile.role === "HOST" && tile.kind === "camera" && (
            <Crown className="text-warning size-3.5 shrink-0" aria-label="Host" />
          )}
          <span className="truncate">{label}</span>
        </div>
        {!tile.isSelf && tile.kind === "camera" && (
          <span className="glass flex h-6 items-center rounded-lg px-1.5">
            {tile.quality === "unknown" ? (
              <Signal className="text-muted-foreground size-3.5" />
            ) : (
              <QualityIndicator quality={tile.quality} />
            )}
          </span>
        )}
      </div>
    </motion.div>
  );
});
