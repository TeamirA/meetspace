"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { DevicePicker } from "@/components/features/lobby/DevicePicker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";
import { SwitchRow } from "@/components/ui/switch";
import { useCallStore } from "@/stores/callStore";
import { useUiStore } from "@/stores/uiStore";
import { useCallSession } from "./context";

export const SHORTCUTS: [string, string][] = [
  ["M", "Mute / unmute microphone"],
  ["V", "Turn camera on / off"],
  ["S", "Start / stop screen sharing"],
  ["H", "Raise / lower hand"],
  ["C", "Open chat"],
  ["P", "Show participants"],
  ["F", "Show shared files"],
  ["W", "Open / close whiteboard"],
  ["L", "Switch grid / speaker view"],
  ["?", "Show keyboard shortcuts"],
];

export function CallDialogs() {
  const session = useCallSession();
  const ui = useUiStore();
  const security = useCallStore((s) => s.security);
  const [, rerender] = useState(0);
  useEffect(() => session.media.subscribe(() => rerender((n) => n + 1)), [session]);
  const s = session.media.settings;

  return (
    <>
      <Dialog open={ui.shortcutsOpen} onOpenChange={ui.setShortcuts}>
        <DialogContent title="Keyboard shortcuts" description="Work in any part of the call except while typing.">
          <ul className="grid gap-2 sm:grid-cols-2">
            {SHORTCUTS.map(([k, label]) => (
              <li key={k} className="bg-muted/60 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm">
                {label} <Kbd>{k}</Kbd>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={ui.settingsOpen} onOpenChange={ui.setSettings}>
        <DialogContent title="Audio & video settings">
          <DevicePicker media={session.media} compact />
          <div className="mt-4 divide-y rounded-xl border px-4">
            <SwitchRow
              id="ns"
              label="Noise suppression"
              description="Reduce background noise like typing or fans."
              checked={s.noiseSuppression}
              onCheckedChange={(v) => void session.media.setAudioProcessing({ noiseSuppression: v })}
            />
            <SwitchRow
              id="ec"
              label="Echo cancellation"
              description="Prevent others from hearing themselves."
              checked={s.echoCancellation}
              onCheckedChange={(v) => void session.media.setAudioProcessing({ echoCancellation: v })}
            />
            <SwitchRow
              id="agc"
              label="Automatic gain"
              description="Keep your volume steady."
              checked={s.autoGainControl}
              onCheckedChange={(v) => void session.media.setAudioProcessing({ autoGainControl: v })}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ui.securityOpen} onOpenChange={ui.setSecurity}>
        <DialogContent title="Security & encryption">
          <div className="space-y-4 text-sm">
            <div className="bg-success/10 flex gap-3 rounded-xl p-3">
              <ShieldCheck className="text-success mt-0.5 size-5 shrink-0" />
              <div>
                <div className="font-medium">Audio and video are encrypted in transit</div>
                <p className="text-muted-foreground">
                  WebRTC encrypts every stream with DTLS-SRTP between participants.
                  {security.mediaE2EE && " This meeting also encrypts media frames end-to-end with the meeting key."}
                </p>
              </div>
            </div>
            <div className="bg-muted/60 flex gap-3 rounded-xl p-3">
              <ShieldCheck className="text-primary mt-0.5 size-5 shrink-0" />
              <div>
                <div className="font-medium">Chat and files are end-to-end encrypted</div>
                <p className="text-muted-foreground">
                  They&apos;re encrypted with AES-GCM on your device. The server only stores ciphertext.
                </p>
              </div>
            </div>
            <div>
              <div className="mb-1.5 font-medium">Security code</div>
              {security.fingerprint ? (
                <>
                  <div
                    className="bg-background rounded-xl border p-4 text-center font-mono text-xl tracking-widest"
                    aria-label={`Security code ${security.fingerprint}`}
                  >
                    {security.fingerprint}
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Everyone in the call should see the same code. Compare it out loud to make sure nobody is
                    intercepting the key exchange.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Exchanging keys with other participants…</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
