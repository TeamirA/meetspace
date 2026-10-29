"use client";

import { Lock, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useEffect, useState } from "react";
import { CopyLinkButton } from "@/components/features/meetings/CopyLinkButton";
import { useCallStore } from "@/stores/callStore";
import { useUiStore } from "@/stores/uiStore";
import { useCallSession } from "./context";

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return <span className="font-mono tabular-nums">{hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`}</span>;
}

export function TopBar() {
  const session = useCallSession();
  const meeting = useCallStore((s) => s.meeting);
  const locked = useCallStore((s) => s.locked);
  const security = useCallStore((s) => s.security);
  const setSecurity = useUiStore((s) => s.setSecurity);
  if (!meeting) return null;
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 px-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-sm font-semibold">{meeting.title}</h1>
          {locked && <Lock className="text-muted-foreground size-3.5" aria-label="Meeting locked" />}
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Elapsed since={session.joinedAt} />
          <span aria-hidden>·</span>
          <span className="font-mono">{meeting.code}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setSecurity(true)}
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition"
        aria-label={security.ready ? "End-to-end encryption active. View security code" : "Setting up encryption"}
      >
        {security.ready ? (
          <ShieldCheck className="text-success size-4" />
        ) : (
          <ShieldQuestion className="size-4 animate-pulse" />
        )}
        <span className="hidden sm:inline">{security.ready ? "Encrypted" : "Securing…"}</span>
      </button>
      <CopyLinkButton code={meeting.code} label="Invite" className="hidden sm:inline-flex" />
    </div>
  );
}
