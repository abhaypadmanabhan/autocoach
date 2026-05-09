import * as React from "react";
import { cn } from "@/lib/utils";

interface BrandMarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  letter?: string;
}

export function BrandMark({
  size = 22,
  letter = "A",
  className,
  ...props
}: BrandMarkProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "rounded-md grid place-items-center",
        "bg-[linear-gradient(135deg,var(--accent)_0%,color-mix(in_oklab,var(--accent)_60%,#000)_100%)]",
        "font-mono font-semibold text-[11px] text-white",
        className,
      )}
      {...props}
    >
      {letter}
    </div>
  );
}
