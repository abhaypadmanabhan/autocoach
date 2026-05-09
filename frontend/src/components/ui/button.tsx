import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md text-[13px] font-medium border border-transparent",
    "transition-[background-color,border-color,color,transform,opacity] duration-[180ms]",
    "[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
    "active:translate-y-[0.5px]",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
    "[&_svg]:pointer-events-none [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
        primary:
          "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
        secondary:
          "bg-[var(--bg-elev)] text-[var(--fg-primary)] border-[var(--line-default)] hover:bg-[var(--bg-overlay)] hover:border-[var(--line-strong)]",
        outline:
          "bg-transparent text-[var(--fg-primary)] border-[var(--line-default)] hover:bg-[var(--bg-elev)] hover:border-[var(--line-strong)]",
        ghost:
          "text-[var(--fg-secondary)] hover:bg-[var(--bg-elev)] hover:text-[var(--fg-primary)]",
        destructive:
          "bg-transparent text-[var(--danger)] border-[color-mix(in_oklab,var(--danger)_30%,transparent)] hover:bg-[color-mix(in_oklab,var(--danger)_10%,transparent)]",
        link: "text-[var(--accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-[14px]",
        sm: "h-[26px] px-[10px] text-[12px]",
        lg: "h-10 px-[18px] text-[14px]",
        xl: "h-12 px-6 text-[14px]",
        icon: "h-8 w-8 p-0",
        "icon-sm": "h-[26px] w-[26px] p-0",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, block, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
