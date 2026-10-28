"use client";

import { CalendarPlus, Clock, Lock, MoreHorizontal, Trash2, Users, Video } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge, Card } from "@/components/ui/misc";
import type { MeetingDto } from "@/core/application/dtos";
import { CopyLinkButton } from "./CopyLinkButton";
import { useDeleteMeeting } from "./useMeetings";

function when(m: MeetingDto) {
  if (!m.scheduledFor) return "Instant meeting";
  const d = new Date(m.scheduledFor);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86_400_000);
  const day =
    d.toDateString() === today.toDateString()
      ? "Today"
      : d.toDateString() === tomorrow.toDateString()
        ? "Tomorrow"
        : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function MeetingCard({ meeting, isHost }: { meeting: MeetingDto; isHost: boolean }) {
  const del = useDeleteMeeting();
  const live = meeting.status === "LIVE" && !meeting.endedAt;
  const date = meeting.scheduledFor ? new Date(meeting.scheduledFor) : null;
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="bg-primary-soft text-accent-foreground flex size-12 shrink-0 flex-col items-center justify-center rounded-xl">
          {date ? (
            <>
              <span className="text-[10px] font-semibold uppercase">
                {date.toLocaleDateString(undefined, { month: "short" })}
              </span>
              <span className="text-lg leading-none font-semibold">{date.getDate()}</span>
            </>
          ) : (
            <Video className="size-5" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{meeting.title}</h3>
            {live && <Badge tone="success">● Live</Badge>}
            {meeting.locked && <Lock className="text-muted-foreground size-3.5" aria-label="Locked" />}
          </div>
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {when(meeting)}
            </span>
            <span className="font-mono text-xs">{meeting.code}</span>
            {meeting.allowGuests && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" />
                Guests allowed
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <CopyLinkButton code={meeting.code} label="Copy" />
        <Button asChild size="sm">
          <Link href={`/m/${meeting.code}`}>{isHost ? (live ? "Rejoin" : "Start") : "Join"}</Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${meeting.title}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {meeting.scheduledFor && (
              <DropdownMenuItem asChild>
                <a href={`/api/meetings/${meeting.code}/ics`} download>
                  <CalendarPlus /> Add to calendar
                </a>
              </DropdownMenuItem>
            )}
            {isHost && (
              <DropdownMenuItem
                destructive
                disabled={live}
                onSelect={() =>
                  del.mutate(meeting.code, {
                    onSuccess: () => toast.success("Meeting deleted"),
                    onError: (e) => toast.error((e as Error).message),
                  })
                }
              >
                <Trash2 /> Delete meeting
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
