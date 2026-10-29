"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUiStore } from "@/stores/uiStore";
import { AudioSinks } from "./AudioSinks";
import { CallDialogs } from "./CallDialogs";
import { useCallSession } from "./context";
import { ControlBar } from "./ControlBar";
import { Banners, CaptionsOverlay, ReactionsOverlay } from "./Overlays";
import { SidePanel } from "./SidePanel";
import { TopBar } from "./TopBar";
import { VideoStage } from "./VideoStage";

// Konva touches `window`, so the board only loads in the browser and only when opened.
const Whiteboard = dynamic(() => import("@/components/features/whiteboard/Whiteboard").then((m) => m.Whiteboard), {
  ssr: false,
  loading: () => <div className="bg-muted size-full animate-pulse rounded-2xl" />,
});

export function CallView() {
  const session = useCallSession();
  const whiteboardOpen = useUiStore((s) => s.whiteboardOpen);
  const ui = useUiStore.getState;

  const shortcuts = useMemo(
    () => ({
      m: () => void session.toggleMic(),
      v: () => void session.toggleCamera(),
      s: () => void session.toggleScreenShare(),
      h: () => session.toggleHand(),
      c: () => ui().togglePanel("chat"),
      p: () => ui().togglePanel("participants"),
      f: () => ui().togglePanel("files"),
      w: () => ui().setWhiteboard(!ui().whiteboardOpen),
      l: () => ui().setLayout(ui().layout === "grid" ? "speaker" : "grid"),
      "?": () => ui().setShortcuts(true),
    }),
    [session, ui],
  );
  useKeyboardShortcuts(shortcuts);

  return (
    <div className="bg-stage fixed inset-0 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <TopBar />
      <div className="relative flex min-h-0 flex-1">
        <main id="main" className="relative min-h-0 min-w-0 flex-1" aria-label="Meeting stage">
          <Banners />
          {whiteboardOpen ? (
            <div className="size-full p-3">
              <Whiteboard />
            </div>
          ) : (
            <VideoStage />
          )}
          <ReactionsOverlay />
          <CaptionsOverlay />
        </main>
        <SidePanel />
      </div>
      <div className="shrink-0 px-3 pt-1 pb-3">
        <ControlBar />
      </div>
      <AudioSinks />
      <CallDialogs />
    </div>
  );
}
