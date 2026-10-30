"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight, History } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/misc";
import type { MeetingDto } from "@/core/application/dtos";
import { api } from "@/lib/api-client";
import { formatDuration } from "@/lib/utils";

export function HistoryList() {
  const q = useInfiniteQuery({
    queryKey: ["meetings", "history"],
    queryFn: ({ pageParam }) =>
      api<{ items: MeetingDto[]; nextCursor: string | null }>(
        `/api/meetings?scope=history${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  // Group by month for a calmer scan.
  const groups = new Map<string, MeetingDto[]>();
  for (const m of items) {
    const key = new Date(m.startedAt!).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Meeting history</h1>
      <p className="text-muted-foreground mt-1">
        Revisit participants, shared files and whiteboards from past meetings.
      </p>
      <div className="mt-8 space-y-8">
        {q.isPending ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : q.isError ? (
          <Card className="text-destructive p-6 text-sm">
            Couldn&apos;t load history.{" "}
            <button className="underline" onClick={() => q.refetch()}>
              Retry
            </button>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              icon={<History />}
              title="No past meetings"
              description="After you host or join a meeting it will appear here."
              action={
                <Button asChild>
                  <Link href="/meetings">Start a meeting</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          [...groups].map(([month, list]) => (
            <section key={month} aria-label={month}>
              <h2 className="text-muted-foreground mb-3 text-sm font-medium">{month}</h2>
              <Card className="divide-y overflow-hidden">
                {list.map((m) => (
                  <Link
                    key={m.id}
                    href={`/history/${m.code}`}
                    className="hover:bg-muted/50 flex items-center gap-4 p-4 transition"
                  >
                    <div className="bg-muted flex size-11 shrink-0 flex-col items-center justify-center rounded-xl text-xs">
                      <span className="font-semibold">{new Date(m.startedAt!).getDate()}</span>
                      <span className="text-muted-foreground text-[10px] uppercase">
                        {new Date(m.startedAt!).toLocaleDateString(undefined, { weekday: "short" })}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{m.title}</div>
                      <div className="text-muted-foreground text-sm">
                        {new Date(m.startedAt!).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        {m.endedAt && ` · ${formatDuration(Date.parse(m.endedAt) - Date.parse(m.startedAt!))}`}
                      </div>
                    </div>
                    {m.status === "LIVE" && !m.endedAt && <Badge tone="success">Live</Badge>}
                    <ChevronRight className="text-muted-foreground size-4" />
                  </Link>
                ))}
              </Card>
            </section>
          ))
        )}
        {q.hasNextPage && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
