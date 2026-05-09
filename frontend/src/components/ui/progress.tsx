"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

type ProgressVariant = "thin" | "hairline";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorClassName?: string;
    variant?: ProgressVariant;
  }
>(({ className, value, indicatorClassName, variant = "thin", ...props }, ref) => {
  const isHairline = variant === "hairline";
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative w-full overflow-hidden",
        isHairline
          ? "h-px bg-[var(--line-subtle)]"
          : "h-1 rounded-full bg-[var(--bg-elev)]",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 bg-[var(--accent)] transition-[transform] duration-[240ms]",
          "[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          isHairline ? "" : "rounded-full",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
