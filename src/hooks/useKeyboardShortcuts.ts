"use client";

import { useEffect } from "react";

export type ShortcutMap = Record<string, () => void>;

/**
 * Single-key shortcuts (e.g. "m", "v", "?"). Ignored while typing in inputs or when a
 * modifier is held, so they never fight with text entry or browser shortcuts.
 */
export function useKeyboardShortcuts(map: ShortcutMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (t?.closest("[data-shortcuts-off]")) return;
      const key = e.key === "?" ? "?" : e.key.toLowerCase();
      const fn = map[key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map, enabled]);
}
