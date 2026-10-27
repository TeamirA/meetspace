import {
  ArrowRight,
  CalendarClock,
  DoorOpen,
  Hand,
  Lock,
  MessageSquareLock,
  MonitorUp,
  PenLine,
  ShieldCheck,
  Smartphone,
  Video,
} from "lucide-react";
import Link from "next/link";
import { HeroPreview } from "@/components/features/marketing/HeroPreview";
import { JoinWithCode } from "@/components/features/meetings/JoinWithCode";
import { SiteHeader } from "@/components/features/shell/SiteHeader";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/misc";

const features = [
  {
    icon: Video,
    title: "Crisp group video",
    body: "Up to six people in a direct peer-to-peer mesh, with grid and speaker views that follow whoever is talking.",
  },
  {
    icon: MonitorUp,
    title: "Share anything",
    body: "Present your whole screen, a window or a tab — with system audio where your browser supports it.",
  },
  {
    icon: PenLine,
    title: "Live whiteboard",
    body: "Sketch, diagram and annotate together. Boards are saved with the meeting and export as PNG.",
  },
  {
    icon: MessageSquareLock,
    title: "Private chat & files",
    body: "Messages and files up to 50 MB are encrypted in your browser before they leave it.",
  },
  {
    icon: DoorOpen,
    title: "Host controls",
    body: "Waiting room, lock, mute, remove, transfer host and end for everyone — you stay in charge.",
  },
  {
    icon: CalendarClock,
    title: "Plan ahead",
    body: "Schedule meetings, share a short link, and add them to any calendar with one click.",
  },
  {
    icon: Hand,
    title: "Feels alive",
    body: "Reactions, raised hands, live captions and active-speaker highlights keep everyone in the loop.",
  },
  {
    icon: Smartphone,
    title: "Works everywhere",
    body: "Full experience on phones and tablets, installable as an app, no downloads required.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent)]"
      />
      <SiteHeader />
      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div>
            <span className="bg-card/60 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <ShieldCheck className="text-primary size-3.5" /> End-to-end encrypted chat & files
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Meet, present and sketch together.{" "}
              <span className="from-primary bg-gradient-to-r to-fuchsia-400 bg-clip-text text-transparent">
                Privately.
              </span>
            </h1>
            <p className="text-muted-foreground mt-5 max-w-xl text-lg text-balance">
              Meetspace brings video calls, screen sharing and a shared whiteboard into one calm, fast workspace that
              runs right in your browser.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-start">
              <Button asChild size="lg">
                <Link href="/meetings">
                  Start a meeting <ArrowRight />
                </Link>
              </Button>
              <JoinWithCode size="lg" className="sm:max-w-sm" />
            </div>
            <p className="text-muted-foreground mt-4 text-xs">Free to use. Invite guests with a link.</p>
          </div>
          <HeroPreview />
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">
              Everything a meeting needs. Nothing it doesn&apos;t.
            </h2>
            <p className="text-muted-foreground mt-3">Built for everyday standups, workshops and catch-ups.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="group bg-card/70 shadow-soft hover:border-primary/40 rounded-2xl border p-5 transition hover:-translate-y-0.5"
              >
                <div className="bg-primary-soft text-accent-foreground mb-4 flex size-10 items-center justify-center rounded-xl">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-medium">{title}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="security" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="bg-card/70 shadow-soft grid gap-10 rounded-3xl border p-8 sm:p-12 lg:grid-cols-2">
            <div>
              <div className="bg-primary text-primary-foreground mb-4 flex size-11 items-center justify-center rounded-xl">
                <Lock className="size-5" />
              </div>
              <h2 className="text-3xl font-semibold tracking-tight">Encryption you don&apos;t have to think about</h2>
              <p className="text-muted-foreground mt-3">
                Your conversations belong to you. Meetspace is designed so our servers relay and store only what they
                can&apos;t read.
              </p>
            </div>
            <ul className="space-y-5 text-sm">
              {[
                [
                  "Audio & video",
                  "Always encrypted in transit with WebRTC's DTLS-SRTP, directly between participants. Optional frame-level end-to-end encryption on supported browsers.",
                ],
                [
                  "Chat & files",
                  "Encrypted with AES-GCM in your browser using a meeting key shared over ECDH. The server stores ciphertext only.",
                ],
                ["Security code", "Compare the code shown in the call to confirm everyone holds the same key."],
                [
                  "Access control",
                  "Only admitted members can join the room channel, fetch relay credentials, or open shared files.",
                ],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-3">
                  <ShieldCheck className="text-primary mt-0.5 size-5 shrink-0" />
                  <div>
                    <div className="font-medium">{title}</div>
                    <div className="text-muted-foreground mt-0.5">{body}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Your next meeting is one click away</h2>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">Create a free account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>
      </main>
      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm sm:flex-row sm:px-6">
          <Logo className="text-foreground" />
          <p>© {new Date().getFullYear()} Meetspace. Made for focused conversations.</p>
        </div>
      </footer>
    </div>
  );
}
