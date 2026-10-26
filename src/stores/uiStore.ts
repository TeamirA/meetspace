"use client";

import { create } from "zustand";

export type SidePanel = "chat" | "participants" | "files" | null;
export type Layout = "grid" | "speaker";

interface UiState {
  panel: SidePanel;
  whiteboardOpen: boolean;
  shortcutsOpen: boolean;
  settingsOpen: boolean;
  securityOpen: boolean;
  layout: Layout;
  pinnedId: string | null;
  togglePanel: (p: Exclude<SidePanel, null>) => void;
  closePanel: () => void;
  setWhiteboard: (open: boolean) => void;
  setShortcuts: (open: boolean) => void;
  setSettings: (open: boolean) => void;
  setSecurity: (open: boolean) => void;
  setLayout: (l: Layout) => void;
  pin: (id: string | null) => void;
  reset: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  panel: null,
  whiteboardOpen: false,
  shortcutsOpen: false,
  settingsOpen: false,
  securityOpen: false,
  layout: "grid",
  pinnedId: null,
  togglePanel: (p) => set((s) => ({ panel: s.panel === p ? null : p })),
  closePanel: () => set({ panel: null }),
  setWhiteboard: (whiteboardOpen) => set({ whiteboardOpen }),
  setShortcuts: (shortcutsOpen) => set({ shortcutsOpen }),
  setSettings: (settingsOpen) => set({ settingsOpen }),
  setSecurity: (securityOpen) => set({ securityOpen }),
  setLayout: (layout) => set({ layout }),
  pin: (pinnedId) =>
    set((s) => ({ pinnedId: s.pinnedId === pinnedId ? null : pinnedId, layout: pinnedId ? "speaker" : s.layout })),
  reset: () =>
    set({
      panel: null,
      whiteboardOpen: false,
      shortcutsOpen: false,
      settingsOpen: false,
      securityOpen: false,
      layout: "grid",
      pinnedId: null,
    }),
}));
