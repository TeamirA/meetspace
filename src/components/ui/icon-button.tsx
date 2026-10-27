"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "./tooltip";

type Tone = "default" | "active" | "danger" | "off";

const tones: Record<Tone, string> = {
  default: "bg-muted/80 text-foreground hover:bg-muted",
  active: "bg-primary text-primary-foreground hover:bg-primary/90",
  off: "bg-destructive/15 text-destructive hover:bg-destructive/25 dark:text-red-300",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: Tone;
  shortcut?: string;
  size?: "sm" | "md" | "lg";
  badge?: number;
  tooltipSide?: "top" | "bottom" | "left" | "right";
}

/** Icon-only button that always carries an accessible label and a tooltip. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = "default", shortcut, size = "md", badge, className, children, tooltipSide, ...props },
  ref,
) {
  const sizes = {
    sm: "size-8 rounded-lg [&_svg]:size-4",
    md: "size-11 rounded-xl [&_svg]:size-5",
    lg: "size-12 rounded-2xl [&_svg]:size-5",
  };
  return (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center transition-[background-color,transform] duration-150 active:scale-95 disabled:opacity-50",
          sizes[size],
          tones[tone],
          className,
        )}
        {...props}
      >
        {children}
        {!!badge && (
          <span className="bg-primary text-primary-foreground ring-background absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold ring-2">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    </Tooltip>
  );
});
