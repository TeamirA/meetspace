"use client";

import { CalendarClock, CalendarPlus, ChevronDown, History, Plus, Video, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, EmptyState, Skeleton } from "@/components/ui/misc";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { formatDuration } from "@/lib/utils";
import { JoinWithCode } from "./JoinWithCode";
import { MeetingCard } from "./MeetingCard";
import { ScheduleMeetingDialog } from "./ScheduleMeetingDialog";
import { useCreateMeeting, useMeetings } from "./useMeetings";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function MeetingsDashboard() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const upcoming = useMeetings("upcoming");
  const recent = useMeetings("recent");
  const create = useCreateMeeting();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const instant = async () => {
    try {
      const m = await create.mutateAsync({ title: `${user?.displayName ?? "My"}'s meeting`, waitingRoom: true });
      router.push(`/m/${m.code}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {greeting()}
            {user ? `, ${user.displayName.split(" ")[0]}` : ""}
          </h1>
        </div>
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="default" loading={create.isPending} className="shrink-0">
                <Plus /> New meeting <ChevronDown className="opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={instant}>
                <Zap /> Start an instant meeting
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setScheduleOpen(true)}>
                <CalendarPlus /> Schedule for later
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <JoinWithCode />
        </Card>
      </section>

      <section aria-labelledby="upcoming-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="upcoming-heading" className="text-lg font-semibold">
            Upcoming
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setScheduleOpen(true)}>
            <CalendarPlus /> Schedule
          </Button>
        </div>
        {upcoming.isPending ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : upcoming.isError ? (
          <Card className="text-destructive p-6 text-sm">
            Couldn&apos;t load meetings.{" "}
            <button className="underline" onClick={() => upcoming.refetch()}>
              Retry
            </button>
          </Card>
        ) : upcoming.data.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarClock />}
              title="Nothing scheduled"
              description="Schedule a meeting to get a shareable link and a calendar invite."
              action={
                <Button onClick={() => setScheduleOpen(true)}>
                  <CalendarPlus /> Schedule a meeting
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.data.map((m) => (
              <MeetingCard key={m.id} meeting={m} isHost={m.hostId === user?.id} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="recent-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recent-heading" className="text-lg font-semibold">
            Recent
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/history">
              <History /> All history
            </Link>
          </Button>
        </div>
        {recent.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : !recent.data?.length ? (
          <Card>
            <EmptyState
              icon={<Video />}
              title="No meetings yet"
              description="Meetings you host or join will show up here."
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.data.map((m) => (
              <Link key={m.id} href={`/history/${m.code}`} className="group">
                <Card className="group-hover:border-primary/40 h-full p-4 transition">
                  <div className="truncate font-medium">{m.title}</div>
                  <div className="text-muted-foreground mt-1 text-sm">
                    {m.startedAt &&
                      new Date(m.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  <div className="text-muted-foreground mt-3 text-xs">
                    {m.startedAt && m.endedAt
                      ? formatDuration(Date.parse(m.endedAt) - Date.parse(m.startedAt))
                      : m.status === "LIVE"
                        ? "In progress"
                        : ""}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
      <ScheduleMeetingDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </div>
  );
}
