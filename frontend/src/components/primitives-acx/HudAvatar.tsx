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
        "rounded-full grid place-items-center",
        "bg-[linear-gradient(135deg,oklch(0.55_0.10_263),oklch(0.45_0.06_263))]",
        "border border-[var(--line-default)]",
        "font-mono text-[11px] text-white",
        "transition-[border-color] duration-[180ms]",
        "hover:border-[var(--line-strong)]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
        className,
      )}
      {...props}
    >
      {initials.toUpperCase().slice(0, 2)}
    </button>
  );
}
