"use client";

import { Circle, MonitorUp, UserPlus, WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCallStore } from "@/stores/callStore";
import { useUiStore } from "@/stores/uiStore";
import { useCallSession } from "./context";

export function ReactionsOverlay() {
  const reactions = useCallStore((s) => s.reactions);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 h-0" aria-live="polite">
      <AnimatePresence>
        {reactions.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], y: -260, scale: [0.5, 1.15, 1, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3.6, ease: "easeOut" }}
            className="absolute bottom-0 flex flex-col items-center"
            style={{ left: `${12 + ((i * 37 + r.id.charCodeAt(0)) % 70)}%` }}
          >
            <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
            <span className="glass mt-1 rounded-full px-2 py-0.5 text-[11px] font-medium">{r.name}</span>
            <span className="sr-only">{`${r.name} reacted ${r.emoji}`}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function CaptionsOverlay() {
  const captions = useCallStore((s) => s.captions);
  const enabled = useCallStore((s) => s.local.captions);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const recent = Object.entries(captions)
    .filter(([, c]) => now - c.at < 6000)
    .sort((a, b) => a[1].at - b[1].at)
    .slice(-2);
  if (!enabled && !recent.length) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex flex-col items-center gap-1.5 px-4"
      aria-live="polite"
    >
      {recent.map(([id, c]) => (
        <div
          key={id}
          className="shadow-float max-w-3xl rounded-xl bg-black/75 px-4 py-2 text-center text-base text-white"
        >
          <span className="mr-2 font-semibold text-violet-300">{c.name}</span>
          {c.text}
        </div>
      ))}
    </div>
  );
}

export function Banners() {
  const session = useCallSession();
  const signaling = useCallStore((s) => s.signaling);
  const online = useCallStore((s) => s.online);
  const screen = useCallStore((s) => s.local.screen);
  const recording = useCallStore((s) => s.local.recording);
  const waiting = useCallStore((s) => s.waiting);
  const isHost = useCallStore((s) => s.self?.role === "HOST");
  const togglePanel = useUiStore((s) => s.togglePanel);
  const reconnecting = !online || signaling === "reconnecting";

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex flex-col items-center gap-2 px-3">
      <AnimatePresence>
        {reconnecting && (
          <motion.div
            key="reconnect"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            role="status"
            className="bg-warning shadow-float pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-black"
          >
            <WifiOff className="size-4" />{" "}
            {online ? "Reconnecting…" : "You're offline. Reconnecting when your network is back…"}
          </motion.div>
        )}
        {screen && (
          <motion.div
            key="presenting"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="glass shadow-float pointer-events-auto flex items-center gap-3 rounded-xl border py-1.5 pr-1.5 pl-4 text-sm font-medium"
          >
            <MonitorUp className="text-primary size-4" /> You are presenting
            <Button size="sm" variant="destructive" onClick={() => void session.toggleScreenShare()}>
              Stop presenting
            </Button>
          </motion.div>
        )}
        {recording && (
          <motion.div
            key="rec"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass pointer-events-auto flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium"
          >
            <Circle className="fill-destructive text-destructive size-3 animate-pulse" /> Recording to this device
          </motion.div>
        )}
        {isHost && waiting.length > 0 && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="glass shadow-float pointer-events-auto flex items-center gap-3 rounded-xl border py-1.5 pr-1.5 pl-4 text-sm"
          >
            <UserPlus className="text-primary size-4" />
            <span>
              <strong>{waiting[0].displayName}</strong>
              {waiting.length > 1 ? ` and ${waiting.length - 1} more want to join` : " wants to join"}
            </span>
            {waiting.length === 1 ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void session.hostAction({ action: "deny", participantId: waiting[0].id })}
                >
                  Deny
                </Button>
                <Button
                  size="sm"
                  onClick={() => void session.hostAction({ action: "admit", participantId: waiting[0].id })}
                >
                  Admit
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => togglePanel("participants")}>
                View all
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
