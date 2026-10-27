"use client";

import { useEffect, useRef } from "react";

/** Attaches a MediaStream to a <video>/<audio> element and keeps it playing. */
export function useMediaStream<T extends HTMLMediaElement>(
  stream: MediaStream | null | undefined,
  version = 0,
  sinkId?: string,
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== (stream ?? null)) el.srcObject = stream ?? null;
    if (stream) void el.play().catch(() => undefined);
  }, [stream, version]);

  useEffect(() => {
    const el = ref.current as (T & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (el?.setSinkId && sinkId) void el.setSinkId(sinkId).catch(() => undefined);
  }, [sinkId]);
  return ref;
}
