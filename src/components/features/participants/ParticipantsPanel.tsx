"use client";

import {
  Crown,
  Hand,
  Lock,
  LockOpen,
  MicOff,
  MoreHorizontal,
  UserMinus,
  Users,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { useCallSession } from "@/components/features/call/context";
import { useCallStore } from "@/stores/callStore";

const qualityTone = { good: "success", fair: "warning", poor: "danger", unknown: "default" } as const;

export function ParticipantsPanel() {
  const session = useCallSession();
  const { self, local, participants, waiting, locked, isHost } = useCallStore(
    useShallow((s) => ({
      self: s.self,
      local: s.local,
      participants: s.participants,
      waiting: s.waiting,
      locked: s.locked,
      isHost: s.self?.role === "HOST",
    })),
  );
  if (!self) return null;

  const people = [
    {
      id: self.id,
      name: `${self.displayName} (You)`,
      role: self.role,
      mic: local.mic,
      cam: local.cam,
      hand: local.handRaisedAt,
      quality: "good" as const,
      isSelf: true,
    },
    ...Object.values(participants).map((p) => ({
      id: p.id,
      name: p.displayName,
      role: p.role,
      mic: p.mic,
      cam: p.cam,
      hand: p.handRaisedAt,
      quality: p.quality,
      isSelf: false,
      isGuest: p.role === "GUEST",
    })),
  ];
  const raised = people.filter((p) => p.hand).sort((a, b) => a.hand! - b.hand!);
  const others = people.filter((p) => !p.hand);

  const Row = ({ p }: { p: (typeof people)[number] & { isGuest?: boolean } }) => (
    <li className="hover:bg-muted/60 flex items-center gap-3 rounded-xl px-2 py-2">
      <Avatar name={p.name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{p.name}</span>
          {p.role === "HOST" && (
            <Badge tone="warning" className="px-1.5">
              <Crown className="size-3" /> Host
            </Badge>
          )}
          {p.isGuest && <Badge className="px-1.5">Guest</Badge>}
        </div>
        {!p.isSelf && p.quality !== "unknown" && (
          <Badge tone={qualityTone[p.quality]} className="mt-0.5 px-1.5 text-[10px] capitalize">
            {p.quality} connection
          </Badge>
        )}
      </div>
      <div className="text-muted-foreground flex items-center gap-1.5">
        {p.hand && <Hand className="text-warning size-4" aria-label="Hand raised" />}
        {p.cam ? (
          <Video className="size-4" aria-label="Camera on" />
        ) : (
          <VideoOff className="size-4" aria-label="Camera off" />
        )}
        {p.mic ? (
          <Volume2 className="size-4" aria-label="Unmuted" />
        ) : (
          <MicOff className="text-destructive size-4" aria-label="Muted" />
        )}
      </div>
      {isHost && !p.isSelf && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`Host actions for ${p.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              disabled={!p.mic}
              onSelect={() => void session.hostAction({ action: "mute", participantId: p.id })}
            >
              <MicOff /> Mute
            </DropdownMenuItem>
            {!p.isGuest && (
              <DropdownMenuItem
                onSelect={() => void session.hostAction({ action: "transfer-host", participantId: p.id })}
              >
                <Crown /> Make host
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              destructive
              onSelect={() => void session.hostAction({ action: "remove", participantId: p.id })}
            >
              <UserMinus /> Remove from meeting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {p.isSelf && p.hand && (
        <Button size="sm" variant="ghost" onClick={() => session.toggleHand()}>
          Lower
        </Button>
      )}
    </li>
  );

  return (
    <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto px-3 pb-4">
      {isHost && (
        <div className="mb-3 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="lock-switch" className="flex items-center gap-2 text-sm font-medium">
              {locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />} Lock meeting
            </label>
            <Switch id="lock-switch" checked={locked} onCheckedChange={(v) => void session.setLocked(v)} />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">New people can&apos;t join or ask to join while locked.</p>
        </div>
      )}

      {isHost && waiting.length > 0 && (
        <section aria-labelledby="waiting-heading" className="mb-4">
          <div className="mb-1 flex items-center justify-between px-2">
            <h3 id="waiting-heading" className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Waiting ({waiting.length})
            </h3>
            {waiting.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => void session.hostAction({ action: "admit-all" })}>
                Admit all
              </Button>
            )}
          </div>
          <ul>
            {waiting.map((w) => (
              <li key={w.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Avatar name={w.displayName} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{w.displayName}</div>
                  <div className="text-muted-foreground text-xs">{w.role === "GUEST" ? "Guest" : "Signed in"}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void session.hostAction({ action: "deny", participantId: w.id })}
                >
                  Deny
                </Button>
                <Button size="sm" onClick={() => void session.hostAction({ action: "admit", participantId: w.id })}>
                  Admit
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {raised.length > 0 && (
        <section aria-labelledby="hands-heading" className="mb-4">
          <h3
            id="hands-heading"
            className="text-muted-foreground mb-1 px-2 text-xs font-semibold tracking-wide uppercase"
          >
            Raised hands
          </h3>
          <ul>
            {raised.map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="in-call-heading">
        <h3
          id="in-call-heading"
          className="text-muted-foreground mb-1 flex items-center gap-1.5 px-2 text-xs font-semibold tracking-wide uppercase"
        >
          <Users className="size-3.5" /> In the call ({people.length})
        </h3>
        <ul>
          {others.map((p) => (
            <Row key={p.id} p={p} />
          ))}
        </ul>
      </section>
    </div>
  );
}
