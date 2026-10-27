"use client";

import { Tooltip as T } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = T.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
  shortcut,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  shortcut?: string;
}) {
  return (
    <T.Root delayDuration={300}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={8}
          className={cn(
            "bg-foreground text-background shadow-float z-50 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium",
            "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out",
          )}
        >
          {content}
          {shortcut && (
            <kbd className="bg-background/20 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase">{shortcut}</kbd>
          )}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
