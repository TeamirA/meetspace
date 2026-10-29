"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMediaStream } from "@/hooks/useMediaStream";
import { useCallStore } from "@/stores/callStore";
import { useCallSession } from "./context";

function Sink({
  id,
  kind,
  version,
  sinkId,
}: {
  id: string;
  kind: "camera" | "screen";
  version: number;
  sinkId?: string;
}) {
  const session = useCallSession();
  const ref = useMediaStream<HTMLAudioElement>(session.getStream(id, kind), version, sinkId);
  return <audio ref={ref} autoPlay />;
}

/**
 * Remote audio plays from dedicated hidden <audio> elements (video tiles are always muted), so
 * people stay audible when their tile is off-screen or the whiteboard covers the stage.
 */
export function AudioSinks() {
  const session = useCallSession();
  const [speakerId, setSpeakerId] = useState(session.media.settings.speakerId);
  useEffect(() => session.media.subscribe(() => setSpeakerId(session.media.settings.speakerId)), [session]);
  const list = useCallStore(
    useShallow((s) =>
      Object.values(s.participants).map((p) => `${p.id}|${p.mediaVersion}|${p.screenStreamId ? 1 : 0}`),
    ),
  );
  return (
    <div className="hidden" aria-hidden>
      {list.map((entry) => {
        const [id, version, screen] = entry.split("|");
        return (
          <span key={id}>
            <Sink id={id} kind="camera" version={Number(version)} sinkId={speakerId} />
            {screen === "1" && <Sink id={id} kind="screen" version={Number(version)} sinkId={speakerId} />}
          </span>
        );
      })}
    </div>
  );
}
