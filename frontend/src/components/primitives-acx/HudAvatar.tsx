"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface HudAvatarProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  initials?: string;
  size?: number;
}

export function HudAvatar({
  initials = "??",
  size = 30,
  className,
  ...props
}: HudAvatarProps) {
  return (
    <button
      type="button"
      style={{ width: size, height: size }}
      className={cn(
        "rounded-none grid place-items-center",
        "bg-[var(--bg-elev)]",
        "border border-[var(--ink)]",
        "font-mono text-[11px] text-[var(--fg-primary)]",
        "transition-[border-color,background-color] duration-[120ms]",
        "hover:bg-[var(--bg-surface)]",
        "focus-visible:outline-none focus-visible:border-[var(--accent)]",
        className,
      )}
      {...props}
    >
      {initials.toUpperCase().slice(0, 2)}
    </button>
  );
}
