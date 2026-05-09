import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md border border-[var(--line-default)] bg-[var(--bg-base)] px-3 py-[10px] text-[14px] leading-[1.55]",
        "text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)]",
        "font-sans resize-y",
        "transition-[border-color] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
        "focus-visible:outline-none focus-visible:border-[var(--accent)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
