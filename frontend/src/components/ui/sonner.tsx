"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast border border-[var(--ink)] bg-[var(--bg-base)] text-[var(--fg-primary)] text-[13px] rounded-none",
          title: "font-mono text-[12px] uppercase tracking-[0.06em]",
          description: "text-[var(--fg-secondary)] font-sans normal-case tracking-normal",
          actionButton:
            "bg-[var(--accent)] text-[var(--ink)] rounded-none border border-[var(--ink)]",
          cancelButton:
            "bg-[var(--bg-elev)] text-[var(--fg-secondary)] rounded-none",
          success: "[&_[data-icon]]:text-[var(--accent)]",
          error: "[&_[data-icon]]:text-[var(--danger)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
