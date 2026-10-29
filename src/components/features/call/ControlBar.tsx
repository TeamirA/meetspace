"use client";

import {
  Captions,
  CaptionsOff,
  ChevronUp,
  Circle,
  Files,
  Hand,
  Keyboard,
  LayoutGrid,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  MoreVertical,
  PenLine,
  PhoneOff,
  Settings,
  ShieldCheck,
  Smile,
  Square,
  UserSquare,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { Popover } from "radix-ui";
import { useShallow } from "zustand/react/shallow";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { REACTIONS } from "@/media/CallSession";
import { useCallStore } from "@/stores/callStore";
import { useUiStore } from "@/stores/uiStore";
import { useCallSession } from "./context";

export function ControlBar() {
  const session = useCallSession();
  const local = useCallStore((s) => s.local);
  const { unread, waitingCount, isHost, participantCount } = useCallStore(
    useShallow((s) => ({
      unread: s.unread,
      waitingCount: s.waiting.length,
      isHost: s.self?.role === "HOST",
      participantCount: Object.keys(s.participants).length + 1,
    })),
  );
  const ui = useUiStore();

  return (
    <div
      role="toolbar"
      aria-label="Call controls"
      className="glass shadow-float mx-auto flex max-w-full scrollbar-thin items-center gap-1.5 overflow-x-auto rounded-2xl border p-2 sm:gap-2"
    >
      <IconButton
        label={local.mic ? "Mute microphone" : "Unmute microphone"}
        shortcut="M"
        tone={local.mic ? "default" : "off"}
        onClick={() => void session.toggleMic()}
      >
        {local.mic ? <Mic /> : <MicOff />}
      </IconButton>
      <IconButton
        label={local.cam ? "Turn off camera" : "Turn on camera"}
        shortcut="V"
        tone={local.cam ? "default" : "off"}
        onClick={() => void session.toggleCamera()}
      >
        {local.cam ? <Video /> : <VideoOff />}
      </IconButton>
      <IconButton
        label={local.screen ? "Stop presenting" : "Share screen"}
        shortcut="S"
        tone={local.screen ? "active" : "default"}
        onClick={() => void session.toggleScreenShare()}
        className="hidden sm:inline-flex"
      >
        {local.screen ? <MonitorX /> : <MonitorUp />}
      </IconButton>

      <Popover.Root>
        <Popover.Trigger asChild>
          <IconButton label="Send a reaction">
            <Smile />
          </IconButton>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            sideOffset={12}
            className="glass shadow-float z-50 flex gap-1 rounded-2xl border p-2"
          >
            {REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => session.sendReaction(e)}
                aria-label={`React with ${e}`}
                className="hover:bg-muted flex size-10 items-center justify-center rounded-xl text-2xl transition hover:scale-110 active:scale-95"
              >
                {e}
              </button>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <IconButton
        label={local.handRaisedAt ? "Lower hand" : "Raise hand"}
        shortcut="H"
        tone={local.handRaisedAt ? "active" : "default"}
        onClick={() => session.toggleHand()}
      >
        <Hand />
      </IconButton>
      <IconButton
        label={ui.whiteboardOpen ? "Close whiteboard" : "Open whiteboard"}
        shortcut="W"
        tone={ui.whiteboardOpen ? "active" : "default"}
        onClick={() => ui.setWhiteboard(!ui.whiteboardOpen)}
      >
        <PenLine />
      </IconButton>

      <span className="bg-border mx-1 hidden h-8 w-px sm:block" aria-hidden />

      <IconButton
        label="Chat"
        shortcut="C"
        tone={ui.panel === "chat" ? "active" : "default"}
        badge={ui.panel === "chat" ? 0 : unread}
        onClick={() => ui.togglePanel("chat")}
      >
        <MessageSquare />
      </IconButton>
      <IconButton
        label={`Participants (${participantCount})`}
        shortcut="P"
        tone={ui.panel === "participants" ? "active" : "default"}
        badge={isHost ? waitingCount : 0}
        onClick={() => ui.togglePanel("participants")}
        className="hidden sm:inline-flex"
      >
        <Users />
      </IconButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label="More options">
            <MoreVertical />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-64">
          <DropdownMenuItem className="sm:hidden" onSelect={() => void session.toggleScreenShare()}>
            <MonitorUp /> {local.screen ? "Stop presenting" : "Share screen"}
          </DropdownMenuItem>
          <DropdownMenuItem className="sm:hidden" onSelect={() => ui.togglePanel("participants")}>
            <Users /> Participants
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => ui.togglePanel("files")}>
            <Files /> Shared files
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => ui.setLayout(ui.layout === "grid" ? "speaker" : "grid")}>
            {ui.layout === "grid" ? <UserSquare /> : <LayoutGrid />}{" "}
            {ui.layout === "grid" ? "Speaker view" : "Grid view"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => session.toggleCaptions()}>
            {local.captions ? <CaptionsOff /> : <Captions />}{" "}
            {local.captions ? "Turn off captions" : "Turn on live captions"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void session.toggleRecording()}>
            {local.recording ? <Square /> : <Circle />} {local.recording ? "Stop recording" : "Record to this device"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => ui.setSecurity(true)}>
            <ShieldCheck /> Security & encryption
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => ui.setSettings(true)}>
            <Settings /> Audio & video settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => ui.setShortcuts(true)}>
            <Keyboard /> Keyboard shortcuts
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isHost ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Leave or end meeting"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 ml-1 inline-flex h-11 items-center gap-1 rounded-xl px-4 transition active:scale-95"
            >
              <PhoneOff className="size-5" />
              <ChevronUp className="size-4 opacity-80" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end">
            <DropdownMenuLabel>You&apos;re the host</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void session.end("left")}>
              <PhoneOff /> Leave meeting
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={() => void session.hostAction({ action: "end" })}>
              <PhoneOff /> End meeting for everyone
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <IconButton label="Leave meeting" tone="danger" onClick={() => void session.end("left")} className="ml-1 w-14">
          <PhoneOff />
        </IconButton>
      )}
    </div>
  );
}
