"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useCallStore } from "@/stores/callStore";
import { useUiStore } from "@/stores/uiStore";
import { useTiles, type TileModel } from "./useTiles";
import { VideoTile } from "./VideoTile";

/** Picks rows × columns that make 16:9 tiles as large as possible in the container. */
function bestGrid(count: number, width: number, height: number) {
  let best = { cols: 1, rows: 1, size: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const w = Math.min(width / cols, ((height / rows) * 16) / 9);
    if (w > best.size) best = { cols, rows, size: w };
  }
  return best;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function VideoStage() {
  const tiles = useTiles();
  const layout = useUiStore((s) => s.layout);
  const pinnedId = useUiStore((s) => s.pinnedId);
  const activeSpeakerId = useCallStore((s) => s.activeSpeakerId);
  const [ref, size] = useSize<HTMLDivElement>();

  const screenTile = tiles.find((t) => t.kind === "screen" && !t.isSelf) ?? tiles.find((t) => t.kind === "screen");
  const pinned = tiles.find((t) => t.key === pinnedId);
  // A screen share takes the main stage automatically, unless something is pinned.
  const speakerMode = layout === "speaker" || !!screenTile || !!pinned;
  const main: TileModel | undefined = speakerMode
    ? (pinned ??
      screenTile ??
      tiles.find((t) => t.participantId === activeSpeakerId && t.kind === "camera" && !t.isSelf) ??
      tiles.find((t) => !t.isSelf) ??
      tiles[0])
    : undefined;

  if (speakerMode && main && tiles.length > 1) {
    const rest = tiles.filter((t) => t.key !== main.key);
    const vertical = size.width > 900;
    return (
      <div ref={ref} className={cn("flex size-full min-h-0 gap-3 p-3", vertical ? "flex-row" : "flex-col")}>
        <div className="relative min-h-0 min-w-0 flex-1">
          <VideoTile tile={main} className="size-full" />
        </div>
        <div
          className={cn(
            "flex shrink-0 scrollbar-thin gap-3 overflow-auto",
            vertical ? "w-56 flex-col" : "h-28 flex-row sm:h-32",
          )}
          aria-label="Other participants"
        >
          <AnimatePresence initial={false}>
            {rest.map((t) => (
              <VideoTile
                key={t.key}
                tile={t}
                compact
                className={cn("shrink-0", vertical ? "aspect-video w-full" : "aspect-video h-full")}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Phones in portrait: stack two people vertically rather than tiny side-by-side tiles.
  const portrait = size.height > size.width;
  const gap = 12;
  const { cols, rows } =
    portrait && tiles.length <= 3
      ? { cols: 1, rows: tiles.length }
      : bestGrid(tiles.length, size.width - gap * 2, size.height - gap * 2);

  return (
    <div ref={ref} className="flex size-full min-h-0 items-center justify-center p-3">
      <div
        className="grid size-full gap-3"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        <AnimatePresence initial={false}>
          {tiles.map((t) => (
            <VideoTile key={t.key} tile={t} compact={tiles.length > 4} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
