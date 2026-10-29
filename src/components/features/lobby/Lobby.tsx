"use client";

import { AlertTriangle, Lock, Mic, MicOff, ShieldCheck, Video, VideoOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Field, Input } from "@/components/ui/input";
import { Badge, Card } from "@/components/ui/misc";
import type { MeetingPreviewDto, UserDto } from "@/core/application/dtos";
import { useMediaStream } from "@/hooks/useMediaStream";
import { createLevelMeter } from "@/media/ActiveSpeakerDetector";
import type { LocalMediaController } from "@/media/LocalMediaController";
import { mediaE2EESupport } from "@/media/MediaE2EE";
import { displayNameSchema } from "@/lib/schemas/auth";
import { DevicePicker } from "./DevicePicker";

const errorText = {
  denied: "Camera and microphone access is blocked. Allow it from the address bar, then reload.",
  "not-found": "We couldn't find a camera or microphone. You can still join and listen.",
  "in-use": "Your camera or microphone is being used by another app.",
  unknown: "We couldn't start your camera or microphone.",
};

export function Lobby({
  preview,
  user,
  media,
  joining,
  error,
  onJoin,
}: {
  preview: MeetingPreviewDto;
  user: UserDto | null;
  media: LocalMediaController;
  joining: boolean;
  error: string | null;
  onJoin: (displayName?: string) => void;
}) {
  const [, rerender] = useState(0);
  const [level, setLevel] = useState(0);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const videoRef = useMediaStream<HTMLVideoElement>(media.stream, media.videoTrack ? 1 : 0);

  useEffect(() => media.subscribe(() => rerender((n) => n + 1)), [media]);
  const audioTrackId = media.audioTrack?.id;
  useEffect(() => {
    if (!audioTrackId) return;
    return createLevelMeter(media.stream, setLevel);
  }, [media, audioTrackId]);

  const hasVideo = media.camEnabled && !!media.videoTrack;
  const guestNeedsName = !user;
  const e2eeBlocked = preview.e2eeMedia && !mediaE2EESupport();
  const signInRequired = !user && !preview.allowGuests;
  const displayName = user?.displayName ?? (name || "You");

  const join = () => {
    if (guestNeedsName) {
      const parsed = displayNameSchema.safeParse(name);
      if (!parsed.success) return setNameError(parsed.error.issues[0].message);
      return onJoin(parsed.data);
    }
    onJoin();
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-8 lg:grid-cols-[1.4fr_1fr] lg:py-16">
      <div>
        <div className="bg-tile shadow-float relative aspect-video overflow-hidden rounded-3xl">
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className={`mirror size-full object-cover transition-opacity ${hasVideo ? "opacity-100" : "opacity-0"}`}
            aria-label="Your camera preview"
          />
          {!hasVideo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Avatar name={displayName} size={88} />
              <span className="text-muted-foreground text-sm">Camera is off</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/50 to-transparent p-4">
            <IconButton
              label={media.micEnabled ? "Turn off microphone" : "Turn on microphone"}
              tone={media.micEnabled ? "default" : "danger"}
              onClick={() => void media.setMicEnabled(!media.micEnabled)}
              size="lg"
              className={media.micEnabled ? "bg-white/20 text-white backdrop-blur hover:bg-white/30" : ""}
            >
              {media.micEnabled ? <Mic /> : <MicOff />}
            </IconButton>
            <IconButton
              label={media.camEnabled ? "Turn off camera" : "Turn on camera"}
              tone={media.camEnabled ? "default" : "danger"}
              onClick={() => void media.setCameraEnabled(!media.camEnabled)}
              size="lg"
              className={media.camEnabled ? "bg-white/20 text-white backdrop-blur hover:bg-white/30" : ""}
            >
              {media.camEnabled ? <Video /> : <VideoOff />}
            </IconButton>
          </div>
          <div className="absolute top-4 left-4 flex items-center gap-2" aria-hidden={!media.audioTrack}>
            <div className="glass flex h-8 items-end gap-0.5 rounded-lg px-2 py-1.5" title="Microphone level">
              {[0.08, 0.2, 0.35, 0.5, 0.7].map((t) => (
                <span
                  key={t}
                  className={`w-1 rounded-full transition-all duration-75 ${media.micEnabled && level > t ? "bg-success" : "bg-foreground/25"}`}
                  style={{ height: `${30 + t * 70}%` }}
                />
              ))}
            </div>
          </div>
        </div>
        {media.lastError && (
          <div
            role="alert"
            className="border-warning/40 bg-warning/10 mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm"
          >
            <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
            {errorText[media.lastError.kind]}
          </div>
        )}
        <div className="mt-5">
          <DevicePicker media={media} />
        </div>
      </div>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap gap-2">
          {preview.status === "LIVE" ? <Badge tone="success">● In progress</Badge> : <Badge>Not started</Badge>}
          {preview.locked && (
            <Badge tone="warning">
              <Lock className="size-3" /> Locked
            </Badge>
          )}
          {preview.e2eeMedia && (
            <Badge tone="primary">
              <ShieldCheck className="size-3" /> E2EE media
            </Badge>
          )}
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance">{preview.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Hosted by {preview.hostName}
          {preview.scheduledFor &&
            ` · ${new Date(preview.scheduledFor).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
        </p>

        <div className="mt-6 space-y-4">
          {signInRequired ? (
            <>
              <p className="text-muted-foreground text-sm">The host requires attendees to sign in.</p>
              <Button asChild size="lg" className="w-full">
                <Link href={`/login?next=/m/${preview.code}`}>Sign in to join</Link>
              </Button>
            </>
          ) : e2eeBlocked ? (
            <p role="alert" className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm">
              This meeting uses end-to-end encrypted media, which your browser doesn&apos;t support. Try the latest
              Chrome, Edge, Safari or Firefox.
            </p>
          ) : (
            <>
              {guestNeedsName ? (
                <Field label="Your name" htmlFor="guest-name" error={nameError ?? undefined}>
                  <Input
                    id="guest-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setNameError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && join()}
                    placeholder="How should others see you?"
                    autoComplete="name"
                    maxLength={60}
                    aria-invalid={!!nameError}
                  />
                </Field>
              ) : (
                <div className="bg-muted flex items-center gap-3 rounded-xl p-3">
                  <Avatar name={user!.displayName} src={user!.avatarUrl} size={36} />
                  <div className="min-w-0 text-sm">
                    <div className="truncate font-medium">{user!.displayName}</div>
                    <div className="text-muted-foreground truncate">{user!.email}</div>
                  </div>
                </div>
              )}
              {error && (
                <p role="alert" className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm">
                  {error}
                </p>
              )}
              <Button size="lg" className="w-full" onClick={join} loading={joining}>
                {preview.isHost ? (preview.status === "LIVE" ? "Rejoin meeting" : "Start meeting") : "Join meeting"}
              </Button>
              {!user && (
                <p className="text-muted-foreground text-center text-xs">
                  Have an account?{" "}
                  <Link href={`/login?next=/m/${preview.code}`} className="text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
