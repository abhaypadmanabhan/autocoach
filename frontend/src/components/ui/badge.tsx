import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5",
    "h-[22px] px-[10px] rounded-full",
    "font-mono text-[11px] uppercase tracking-[0.06em]",
    "border",
    "transition-colors duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-[var(--line-default)] bg-[var(--bg-elev)] text-[var(--fg-secondary)]",
        accent:
          "border-[var(--accent-line)] bg-[var(--accent-fade)] text-[var(--accent)]",
        success:
          "border-[color-mix(in_oklab,var(--success)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--success)_8%,var(--bg-elev))] text-[var(--success)]",
        warning:
          "border-[color-mix(in_oklab,var(--warning)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--warning)_8%,var(--bg-elev))] text-[var(--warning)]",
        danger:
          "border-[color-mix(in_oklab,var(--danger)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--bg-elev))] text-[var(--danger)]",
        streak:
          "border-[color-mix(in_oklab,var(--streak)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--streak)_8%,var(--bg-elev))] text-[var(--streak)]",
        outline:
          "border-[var(--line-default)] bg-transparent text-[var(--fg-primary)]",
        // Legacy aliases used in older components — map to new variants
        secondary:
          "border-[var(--line-default)] bg-[var(--bg-elev)] text-[var(--fg-secondary)]",
        destructive:
          "border-[color-mix(in_oklab,var(--danger)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--bg-elev))] text-[var(--danger)]",
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
