"use client";

import { CalendarPlus, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { SwitchRow } from "@/components/ui/switch";
import type { MeetingDto } from "@/core/application/dtos";
import { ApiError } from "@/lib/api-client";
import { mediaE2EESupport } from "@/media/MediaE2EE";
import { meetingUrl } from "@/lib/utils";
import { CopyLinkButton } from "./CopyLinkButton";
import { useCreateMeeting } from "./useMeetings";

function defaultStart() {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function ScheduleMeetingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateMeeting();
  const [created, setCreated] = useState<MeetingDto | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [opts, setOpts] = useState({ waitingRoom: true, allowGuests: false, e2eeMedia: false });
  const [start] = useState(defaultStart);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o)
      setTimeout(() => {
        setCreated(null);
        setErrors({});
      }, 200);
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const when = new Date(`${f.get("date")}T${f.get("time")}`);
    if (Number.isNaN(when.getTime())) return setErrors({ scheduledFor: "Pick a valid date and time." });
    try {
      const meeting = await create.mutateAsync({
        title: String(f.get("title") ?? ""),
        description: String(f.get("description") ?? "") || null,
        scheduledFor: when.toISOString(),
        durationMinutes: Number(f.get("duration")),
        ...opts,
      });
      setCreated(meeting);
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors;
        setErrors(
          Object.keys(fe).length
            ? Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]]))
            : { _: err.message },
        );
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      {created ? (
        <DialogContent title="Meeting scheduled" description={created.title}>
          <div className="bg-muted flex items-center gap-3 rounded-xl p-3">
            <div className="bg-success/20 text-success flex size-9 items-center justify-center rounded-full">
              <Check className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-sm">{meetingUrl(created.code)}</div>
              <div className="text-muted-foreground text-xs">
                {new Date(created.scheduledFor!).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/meetings/${created.code}/ics`} download>
                <CalendarPlus /> Add to calendar
              </a>
            </Button>
            <CopyLinkButton code={created.code} />
            <Button size="sm" onClick={() => close(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      ) : (
        <DialogContent title="Schedule a meeting" description="We'll create a link you can share right away.">
          <form onSubmit={submit} className="space-y-4" noValidate>
            {errors._ && (
              <p role="alert" className="text-destructive text-sm">
                {errors._}
              </p>
            )}
            <Field label="Title" htmlFor="title" error={errors.title}>
              <Input
                id="title"
                name="title"
                required
                maxLength={120}
                placeholder="Weekly sync"
                aria-invalid={!!errors.title}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_0.8fr]">
              <Field label="Date" htmlFor="date" error={errors.scheduledFor}>
                <Input id="date" name="date" type="date" defaultValue={start.date} required />
              </Field>
              <Field label="Time" htmlFor="time">
                <Input id="time" name="time" type="time" defaultValue={start.time} required />
              </Field>
              <div className="col-span-2 sm:col-span-1">
                <Field label="Duration" htmlFor="duration">
                  <NativeSelect id="duration" name="duration" defaultValue="60">
                    {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                      <option key={m} value={m}>
                        {m < 60 ? `${m} min` : `${m / 60} h${m % 60 ? " 30" : ""}`}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
            </div>
            <Field label="Description" htmlFor="description" error={errors.description}>
              <Textarea
                id="description"
                name="description"
                maxLength={2000}
                placeholder="Agenda, links, notes (optional)"
              />
            </Field>
            <div className="divide-y rounded-xl border px-4">
              <SwitchRow
                id="waitingRoom"
                label="Waiting room"
                description="You admit people before they can join."
                checked={opts.waitingRoom}
                onCheckedChange={(v) => setOpts((o) => ({ ...o, waitingRoom: v }))}
              />
              <SwitchRow
                id="allowGuests"
                label="Allow guests"
                description="People without an account can join with a name."
                checked={opts.allowGuests}
                onCheckedChange={(v) => setOpts((o) => ({ ...o, allowGuests: v }))}
              />
              <SwitchRow
                id="e2eeMedia"
                label="End-to-end encrypt audio & video (beta)"
                description={
                  mediaE2EESupport()
                    ? "Every participant needs a browser that supports encoded transforms."
                    : "Not supported in this browser."
                }
                checked={opts.e2eeMedia}
                disabled={!mediaE2EESupport()}
                onCheckedChange={(v) => setOpts((o) => ({ ...o, e2eeMedia: v }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={create.isPending}>
                Schedule
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
