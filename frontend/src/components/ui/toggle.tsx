"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-md font-medium",
    "transition-colors duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
    "text-[var(--fg-secondary)] hover:bg-[var(--bg-elev)] hover:text-[var(--fg-primary)]",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "data-[state=on]:bg-[var(--accent-fade)] data-[state=on]:text-[var(--accent)]",
    "[&_svg]:pointer-events-none [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-[var(--line-default)] bg-transparent hover:border-[var(--line-strong)]",
      },
      size: {
        default: "h-8 px-3 text-[13px] min-w-8",
        sm: "h-[26px] px-2 text-[12px] min-w-[26px]",
        lg: "h-10 px-4 text-[14px] min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));
Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
