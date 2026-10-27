"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { IconButton } from "@/components/ui/icon-button";

const subscribe = () => () => undefined;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const Icon = !mounted ? Moon : theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <IconButton
      label={mounted ? `Theme: ${theme}. Switch to ${next}` : "Toggle theme"}
      size="sm"
      tone="default"
      className="hover:bg-muted bg-transparent"
      onClick={() => setTheme(next)}
      tooltipSide="bottom"
    >
      <Icon />
    </IconButton>
  );
}
