"use client";

import { createContext, use } from "react";
import type { CallSession } from "@/media/CallSession";

export const CallSessionContext = createContext<CallSession | null>(null);

export function useCallSession(): CallSession {
  const s = use(CallSessionContext);
  if (!s) throw new Error("useCallSession must be used inside a call");
  return s;
}
