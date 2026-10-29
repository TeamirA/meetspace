"use client";

import { Camera, Mic, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { NativeSelect } from "@/components/ui/input";
import { supportsSpeakerSelection, type DeviceLists, type LocalMediaController } from "@/media/LocalMediaController";

const label = (d: MediaDeviceInfo, i: number, kind: string) => d.label || `${kind} ${i + 1}`;

/** Camera / microphone / speaker selectors bound to a LocalMediaController. */
export function DevicePicker({ media, compact }: { media: LocalMediaController; compact?: boolean }) {
  const [devices, setDevices] = useState<DeviceLists>({ microphones: [], cameras: [], speakers: [] });
  const [, force] = useState(0);

  useEffect(() => {
    const refresh = () =>
      void media
        .listDevices()
        .then(setDevices)
        .catch(() => undefined);
    refresh();
    return media.subscribe(() => {
      refresh();
      force((n) => n + 1);
    });
  }, [media]);

  const current = (track: MediaStreamTrack | null, fallback?: string) =>
    track?.getSettings().deviceId ?? fallback ?? "";
  const rows = [
    {
      icon: Mic,
      id: "mic-select",
      name: "Microphone",
      list: devices.microphones,
      value: current(media.audioTrack, media.settings.microphoneId),
      onChange: (id: string) => media.switchMicrophone(id),
    },
    {
      icon: Camera,
      id: "cam-select",
      name: "Camera",
      list: devices.cameras,
      value: current(media.videoTrack, media.settings.cameraId),
      onChange: (id: string) => media.switchCamera(id),
    },
    ...(supportsSpeakerSelection()
      ? [
          {
            icon: Volume2,
            id: "speaker-select",
            name: "Speaker",
            list: devices.speakers,
            value: media.settings.speakerId ?? "default",
            onChange: async (id: string) => media.setSpeaker(id),
          },
        ]
      : []),
  ];

  return (
    <div className={compact ? "space-y-3" : "grid gap-3 sm:grid-cols-3"}>
      {rows.map(({ icon: Icon, id, name, list, value, onChange }) => (
        <div key={id} className="min-w-0">
          <label htmlFor={id} className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
            <Icon className="size-3.5" /> {name}
          </label>
          <NativeSelect
            id={id}
            value={list.some((d) => d.deviceId === value) ? value : ""}
            onChange={(e) => void onChange(e.target.value)}
            disabled={!list.length}
            className="h-10 text-[13px]"
          >
            {!list.length && <option value="">No {name.toLowerCase()} found</option>}
            {list.length > 0 && !list.some((d) => d.deviceId === value) && <option value="">Default</option>}
            {list.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {label(d, i, name)}
              </option>
            ))}
          </NativeSelect>
        </div>
      ))}
    </div>
  );
}
