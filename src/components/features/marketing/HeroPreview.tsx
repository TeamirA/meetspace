"use client";

import { Hand, MessageSquare, Mic, MicOff, MonitorUp, PhoneOff, Smile, Video } from "lucide-react";
import { motion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";

const people = [
  { name: "Amara Okafor", speaking: true },
  { name: "Lukas Brandt", muted: true },
  { name: "Mei Tanaka", hand: true },
  { name: "Diego Ramírez" },
];

/** Decorative, non-interactive illustration of a call for the landing page. */
export function HeroPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative"
      aria-hidden
    >
      <div className="from-primary/25 absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr via-fuchsia-500/10 to-transparent blur-2xl" />
      <div className="bg-stage shadow-float rounded-3xl border p-3">
        <div className="grid grid-cols-2 gap-3">
          {people.map((p, i) => (
            <div
              key={p.name}
              className={`bg-tile relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl ${
                p.speaking ? "ring-primary ring-offset-stage ring-2 ring-offset-2" : ""
              }`}
            >
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  background: `radial-gradient(120% 90% at ${30 + i * 15}% 20%, oklch(0.5 0.12 ${250 + i * 30} / 0.55), transparent)`,
                }}
              />
              <Avatar name={p.name} size={52} />
              <div className="glass absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium">
                {p.muted ? <MicOff className="size-3 text-red-400" /> : <Mic className="size-3" />}
                {p.name.split(" ")[0]}
              </div>
              {p.hand && (
                <div className="bg-warning absolute top-2 right-2 flex size-7 items-center justify-center rounded-full text-black">
                  <Hand className="size-3.5" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-center">
          <div className="glass shadow-float flex items-center gap-2 rounded-2xl border p-2">
            {[Mic, Video, MonitorUp, Smile, MessageSquare].map((Icon, i) => (
              <span
                key={i}
                className={`flex size-9 items-center justify-center rounded-xl ${i === 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                <Icon className="size-4" />
              </span>
            ))}
            <span className="bg-destructive flex h-9 w-12 items-center justify-center rounded-xl text-white">
              <PhoneOff className="size-4" />
            </span>
          </div>
        </div>
      </div>
      <motion.div
        className="bg-popover shadow-float absolute -bottom-6 -left-4 hidden rounded-2xl border p-3 sm:block"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="text-muted-foreground text-xs">Mei · 10:42</div>
        <div className="mt-0.5 text-sm">Sharing the roadmap now 🎉</div>
      </motion.div>
    </motion.div>
  );
}
