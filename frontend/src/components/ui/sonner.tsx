"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast border border-[var(--line-default)] bg-[var(--bg-overlay)] text-[var(--fg-primary)] text-[13px] rounded-md shadow-[0_10px_32px_rgba(0,0,0,0.4)]",
          description: "text-[var(--fg-secondary)]",
          actionButton:
            "bg-[var(--accent)] text-white",
          cancelButton:
            "bg-[var(--bg-elev)] text-[var(--fg-secondary)]",
          success: "[&_[data-icon]]:text-[var(--success)]",
          error: "[&_[data-icon]]:text-[var(--danger)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
