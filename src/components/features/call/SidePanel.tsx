"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import { ChatPanel } from "@/components/features/chat/ChatPanel";
import { FilesPanel } from "@/components/features/files/FilesPanel";
import { ParticipantsPanel } from "@/components/features/participants/ParticipantsPanel";
import { useUiStore } from "@/stores/uiStore";

const titles = { chat: "In-call messages", participants: "People", files: "Shared files" } as const;

export function SidePanel() {
  const panel = useUiStore((s) => s.panel);
  const closePanel = useUiStore((s) => s.closePanel);
  const ref = useRef<HTMLElement>(null);
  // Release focus from the closing panel (e.g. the chat box) so shortcuts like H work right away.
  const close = useCallback(() => {
    if (ref.current?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    closePanel();
  }, [closePanel]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, close]);

  return (
    <AnimatePresence>
      {panel && (
        <motion.aside
          ref={ref}
          tabIndex={-1}
          key="panel"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          aria-label={titles[panel]}
          className="glass md:shadow-float fixed inset-0 z-40 flex flex-col border-l outline-none md:relative md:inset-auto md:z-auto md:m-3 md:ml-0 md:w-[360px] md:shrink-0 md:rounded-2xl md:border"
        >
          <div className="flex h-14 shrink-0 items-center justify-between px-4">
            <h2 className="font-semibold">{titles[panel]}</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close panel"
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1.5"
            >
              <X className="size-5" />
            </button>
          </div>
          {panel === "chat" && <ChatPanel />}
          {panel === "participants" && <ParticipantsPanel />}
          {panel === "files" && <FilesPanel />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
