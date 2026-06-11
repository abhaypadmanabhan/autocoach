import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5",
    "h-[22px] px-2 rounded-none",
    "font-mono text-[11px] uppercase tracking-[0.06em]",
    "border",
    "transition-colors duration-[120ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)]",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-[var(--line-default)] bg-transparent text-[var(--fg-secondary)]",
        accent:
          "border-[var(--accent)] bg-transparent text-[var(--accent-text)]",
        success:
          "border-[var(--accent)] bg-transparent text-[var(--accent-text)]",
        warning:
          "border-[var(--line-strong)] bg-transparent text-[var(--fg-primary)]",
        danger:
          "border-[var(--danger)] bg-transparent text-[var(--danger)]",
        streak:
          "border-[var(--line-strong)] bg-transparent text-[var(--fg-primary)]",
        outline:
          "border-[var(--line-default)] bg-transparent text-[var(--fg-primary)]",
        // Legacy aliases used in older components — map to new variants
        secondary:
          "border-[var(--line-default)] bg-transparent text-[var(--fg-secondary)]",
        destructive:
          "border-[var(--danger)] bg-transparent text-[var(--danger)]",
        // Mono status text + dot, no frame — quiet status replacement for pills
        dot: "border-transparent px-0 text-[var(--fg-secondary)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
