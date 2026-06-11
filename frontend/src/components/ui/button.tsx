import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-none text-[13px] font-medium border-2 border-transparent",
    "transition-[background-color,border-color,color,transform,box-shadow,opacity] duration-[120ms]",
    "[transition-timing-function:cubic-bezier(0.2,0,0,1)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]",
    "[&_svg]:pointer-events-none [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] text-[var(--ink)] border-[var(--ink)] shadow-hard hover:bg-[var(--accent-hover)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        primary:
          "bg-[var(--accent)] text-[var(--ink)] border-[var(--ink)] shadow-hard hover:bg-[var(--accent-hover)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        secondary:
          "bg-[var(--bg-elev)] text-[var(--fg-primary)] border-[var(--ink)] hover:bg-[var(--bg-surface)] active:translate-y-[1px]",
        outline:
          "bg-transparent text-[var(--fg-primary)] border-[var(--ink)] hover:bg-[var(--bg-surface)] active:translate-y-[1px]",
        ghost:
          "text-[var(--fg-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--fg-primary)] active:translate-y-[1px]",
        destructive:
          "bg-transparent text-[var(--danger)] border-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] active:translate-y-[1px]",
        link: "text-[var(--accent-text)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-[14px]",
        sm: "h-[28px] px-[10px] text-[12px]",
        lg: "h-10 px-[18px] text-[14px]",
        xl: "h-12 px-6 text-[14px]",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-[28px] w-[28px] p-0",
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
