"use client";

import * as React from "react";
import { Flame, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

type Variant = "streak" | "xp" | "generic";

interface HudPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  value?: number | string;
  label?: string;
  icon?: React.ReactNode;
  hideValueOnMobile?: boolean;
}

export function HudPill({
  variant = "generic",
  value,
  label,
  icon,
  hideValueOnMobile = false,
  className,
  children,
  ...props
}: HudPillProps) {
  const renderedIcon =
    icon ??
    (variant === "streak" ? <Flame fill="currentColor" /> : variant === "xp" ? <Trophy /> : null);

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5",
        "h-[30px] px-3 rounded-full",
        "border border-[var(--line-default)] bg-[var(--bg-elev)]",
        "font-mono text-[12px] tabular-nums",
        "text-[var(--fg-secondary)]",
        "transition-[border-color,background-color] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
        "hover:border-[var(--line-strong)]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
        variant === "streak" && "[&_svg]:text-[var(--streak)]",
        variant === "xp" && "[&_svg]:text-[var(--fg-secondary)]",
        "[&_svg]:h-3 [&_svg]:w-3",
        className,
      )}
      {...props}
    >
      {renderedIcon}
      {value !== undefined && (
        <span
          className={cn(
            variant === "streak" ? "text-[var(--streak)]" : "text-[var(--fg-primary)]",
            hideValueOnMobile && "hidden sm:inline",
          )}
        >
          {value}
        </span>
      )}
      {label && (
        <span className="text-[var(--fg-tertiary)] uppercase tracking-[0.06em]">
          {label}
        </span>
      )}
      {children}
    </button>
  );
}
