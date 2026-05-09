"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ToastProvider } from "@/components/ui/Toast";
import { AppSidebar } from "./AppSidebar";
import { TopNav } from "./TopNav";

interface AppShellProps {
  children: ReactNode;
  showNav?: boolean;
  showSidebar?: boolean;
  showBack?: boolean;
  backHref?: string;
  eyebrow?: string;
  title?: string;
  showHud?: boolean;
  rightContent?: ReactNode;
  centerContent?: ReactNode;
  navClassName?: string;
  mainClassName?: string;
}

export function AppShell({
  children,
  showNav = true,
  showSidebar = true,
  showBack = false,
  backHref,
  eyebrow,
  title,
  showHud = true,
  rightContent,
  centerContent,
  navClassName,
  mainClassName,
}: AppShellProps) {
  return (
    <ToastProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-base)] text-[var(--fg-primary)]">
        {showSidebar && (
          <aside className="hidden lg:flex w-[260px] shrink-0 h-full">
            <AppSidebar />
          </aside>
        )}

        <div className="flex-1 flex flex-col min-w-0 h-full">
          {showNav && (
            <TopNav
              className={navClassName}
              showBack={showBack}
              backHref={backHref}
              eyebrow={eyebrow}
              title={title}
              showHud={showHud}
              showSidebarTrigger={showSidebar}
              rightContent={rightContent}
              centerContent={centerContent}
            />
          )}
          <main className={cn("flex-1 overflow-y-auto", mainClassName)}>
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

export function PageContainer({
  children,
  className,
  size = "lg",
}: {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}) {
  const sizes = {
    sm: "max-w-[600px]",
    md: "max-w-[720px]",
    lg: "max-w-[1080px]",
    xl: "max-w-[1280px]",
    full: "max-w-none",
  };
  return (
    <div
      className={cn(
        sizes[size],
        "mx-auto px-4 sm:px-6 lg:px-8",
        "py-6 sm:py-8 lg:py-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("my-8 sm:my-10 lg:my-12 first:mt-0", className)}>
      {children}
    </section>
  );
}
