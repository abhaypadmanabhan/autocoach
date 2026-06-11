import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-none border-2 border-[var(--ink)] bg-[var(--bg-base)] px-3 text-[13px]",
          "text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)]",
          "transition-[border-color,background-color] duration-[120ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)]",
          "focus-visible:outline-none focus-visible:border-[var(--accent)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-[var(--fg-primary)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
