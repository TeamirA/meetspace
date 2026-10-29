"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleSlash, Hourglass, Loader2, LogIn, SearchX } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CallView } from "@/components/features/call/CallView";
import { CallSessionContext } from "@/components/features/call/context";
import { ThemeToggle } from "@/components/features/shell/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, Logo } from "@/components/ui/misc";
import type { MeetingPreviewDto, ParticipantDto } from "@/core/application/dtos";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api, ApiError } from "@/lib/api-client";
import { CallSession, type Notice } from "@/media/CallSession";
import { LocalMediaController } from "@/media/LocalMediaController";
import { useCallStore } from "@/stores/callStore";
import { useUiStore } from "@/stores/uiStore";
import { Lobby } from "./Lobby";

type Phase =
  | { kind: "lobby" }
  | { kind: "waiting" }
  | { kind: "denied" }
  | { kind: "connecting" }
  | { kind: "call"; session: CallSession };

function showNotice(n: Notice) {
  const opts = { id: n.id, description: n.description };
  if (n.kind === "error") toast.error(n.title, opts);
  else if (n.kind === "warning") toast.warning(n.title, opts);
  else if (n.kind === "success") toast.success(n.title, opts);
  else toast(n.title, opts);
}

export function MeetingRoom({ code }: { code: string }) {
  const { data: user, isPending: userPending } = useCurrentUser();
  const preview = useQuery({
    queryKey: ["meeting-preview", code],
    queryFn: () => api<{ meeting: MeetingPreviewDto }>(`/api/meetings/${code}`).then((r) => r.meeting),
    enabled: !userPending,
  });
  const [media, setMedia] = useState<LocalMediaController | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "lobby" });
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callPhase = useCallStore((s) => s.phase);
  const endReason = useCallStore((s) => s.endReason);
  const sessionRef = useRef<CallSession | null>(null);
  const mediaRef = useRef<LocalMediaController | null>(null);

  // One media controller per visit; the lobby preview hands its tracks straight to the call.
  useEffect(() => {
    if (phase.kind !== "lobby" || mediaRef.current) return;
    const prefs = user?.preferences ?? {};
    const m = new LocalMediaController({
      cameraId: prefs.cameraId,
      microphoneId: prefs.microphoneId,
      speakerId: prefs.speakerId,
      noiseSuppression: prefs.noiseSuppression ?? true,
      echoCancellation: prefs.echoCancellation ?? true,
    });
    mediaRef.current = m;
    void m.start({ audio: true, video: true });
    setMedia(m);
  }, [phase.kind, media, user?.preferences]);

  useEffect(() => {
    return () => {
      // Leaving the page: end the call, or release the camera if we never joined.
      if (sessionRef.current) void sessionRef.current.end("left");
      else mediaRef.current?.dispose();
      sessionRef.current = null;
      mediaRef.current = null;
      useUiStore.getState().reset();
    };
  }, []);

  const enterCall = useCallback(async () => {
    if (!media) return;
    setPhase({ kind: "connecting" });
    try {
      const session = await CallSession.join(code, media, showNotice);
      sessionRef.current = session;
      setPhase({ kind: "call", session });
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Couldn't connect to the meeting. Check your connection and try again.",
      );
      setPhase({ kind: "lobby" });
    }
  }, [code, media]);

  const join = async (displayName?: string) => {
    setJoining(true);
    setError(null);
    try {
      const { participant } = await api<{ participant: ParticipantDto }>(`/api/meetings/${code}/join`, {
        method: "POST",
        body: displayName ? { displayName } : {},
      });
      if (participant.status === "ADMITTED") await enterCall();
      else setPhase({ kind: "waiting" });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  // Waiting room: poll until the host decides.
  useEffect(() => {
    if (phase.kind !== "waiting") return;
    let stopped = false;
    const poll = async () => {
      try {
        const { participant } = await api<{ participant: ParticipantDto }>(`/api/meetings/${code}/me`);
        if (stopped) return;
        if (participant.status === "ADMITTED") return void enterCall();
        if (participant.status === "DENIED" || participant.status === "REMOVED") return setPhase({ kind: "denied" });
      } catch {
        // keep polling
      }
      if (!stopped) setTimeout(poll, 2500);
    };
    const t = setTimeout(poll, 1500);
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, [phase.kind, code, enterCall]);

  const cancelWaiting = async () => {
    await api(`/api/meetings/${code}/leave`, { method: "POST" }).catch(() => undefined);
    setPhase({ kind: "lobby" });
  };

  if (phase.kind === "call" && (callPhase === "ended" || callPhase === "removed")) {
    return (
      <EndScreen
        title={endReason ?? "Call ended"}
        removed={callPhase === "removed"}
        onRejoin={() => {
          sessionRef.current = null;
          mediaRef.current = null;
          setMedia(null);
          setPhase({ kind: "lobby" });
          void preview.refetch();
        }}
        signedIn={!!user}
      />
    );
  }

  if (phase.kind === "call") {
    return (
      <CallSessionContext value={phase.session}>
        <CallView />
      </CallSessionContext>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Link href={user ? "/meetings" : "/"} aria-label="Meetspace home">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main id="main" className="flex flex-1 items-center justify-center">
        {preview.isPending || userPending || !media ? (
          <div className="text-muted-foreground flex items-center gap-2" role="status">
            <Loader2 className="size-5 animate-spin" /> Getting things ready…
          </div>
        ) : preview.isError ? (
          <Card className="mx-4 max-w-md p-8 text-center">
            <SearchX className="text-muted-foreground mx-auto size-10" />
            <h1 className="mt-4 text-xl font-semibold">Meeting not found</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Check the code <span className="font-mono">{code}</span> and try again.
            </p>
            <Button asChild className="mt-6">
              <Link href={user ? "/meetings" : "/"}>Go back</Link>
            </Button>
          </Card>
        ) : phase.kind === "waiting" || phase.kind === "connecting" ? (
          <Card className="mx-4 max-w-md p-8 text-center" role="status" aria-live="polite">
            <div className="bg-primary-soft text-accent-foreground mx-auto flex size-14 items-center justify-center rounded-2xl">
              {phase.kind === "waiting" ? (
                <Hourglass className="size-6 animate-pulse" />
              ) : (
                <Loader2 className="size-6 animate-spin" />
              )}
            </div>
            <h1 className="mt-4 text-xl font-semibold">
              {phase.kind === "waiting" ? "Waiting for the host" : "Joining…"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {phase.kind === "waiting"
                ? "You'll join automatically as soon as someone lets you in."
                : "Connecting securely to the meeting."}
            </p>
            {phase.kind === "waiting" && (
              <Button variant="ghost" className="mt-6" onClick={cancelWaiting}>
                Cancel
              </Button>
            )}
          </Card>
        ) : phase.kind === "denied" ? (
          <Card className="mx-4 max-w-md p-8 text-center">
            <CircleSlash className="text-destructive mx-auto size-10" />
            <h1 className="mt-4 text-xl font-semibold">You can&apos;t join this meeting</h1>
            <p className="text-muted-foreground mt-2 text-sm">The host declined your request.</p>
            <Button asChild className="mt-6">
              <Link href={user ? "/meetings" : "/"}>Go back</Link>
            </Button>
          </Card>
        ) : (
          <Lobby
            preview={preview.data}
            user={user ?? null}
            media={media}
            joining={joining}
            error={error}
            onJoin={join}
          />
        )}
      </main>
    </div>
  );
}

function EndScreen({
  title,
  removed,
  onRejoin,
  signedIn,
}: {
  title: string;
  removed: boolean;
  onRejoin: () => void;
  signedIn: boolean;
}) {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="bg-muted mx-auto flex size-14 items-center justify-center rounded-2xl">
          <LogIn className="size-6 rotate-180" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {removed
            ? "If you think this was a mistake, contact the host."
            : "Thanks for joining. Your shared files and whiteboard stay in the meeting history."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {!removed && (
            <Button variant="outline" onClick={onRejoin}>
              Rejoin
            </Button>
          )}
          <Button asChild>
            <Link href={signedIn ? "/meetings" : "/"}>{signedIn ? "Back to dashboard" : "Return home"}</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}
