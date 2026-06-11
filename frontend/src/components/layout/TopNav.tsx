"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Menu } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useUserStats } from "@/hooks/useDailySprint";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { HudPill } from "@/components/primitives-acx/HudPill";
import { AppSidebar } from "./AppSidebar";

interface TopNavProps {
  showBack?: boolean;
  backHref?: string;
  eyebrow?: string;
  title?: string;
  showHud?: boolean;
  showSidebarTrigger?: boolean;
  rightContent?: ReactNode;
  centerContent?: ReactNode;
  className?: string;
}

export function TopNav({
  showBack = false,
  backHref,
  eyebrow,
  title,
  showHud = true,
  showSidebarTrigger = true,
  rightContent,
  centerContent,
  className,
}: TopNavProps) {
  const router = useRouter();
  const { streak, totalXp } = useUserStats();

  const handleBack = () => {
    if (backHref) router.push(backHref);
    else router.back();
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center justify-between h-14 px-4 sm:px-6",
        "border-b border-[var(--line-subtle)] bg-[var(--bg-base)]",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {showSidebarTrigger && (
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px]">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <AppSidebar />
            </SheetContent>
          </Sheet>
        )}
        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="grid place-items-center h-7 w-7 rounded-sm text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {(eyebrow || title) && (
          <div className="flex items-center gap-3 min-w-0">
            {eyebrow && (
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)] hidden sm:inline">
                {eyebrow}
              </span>
            )}
            {eyebrow && title && (
              <span className="text-[var(--fg-disabled)] hidden sm:inline">/</span>
            )}
            {title && (
              <span className="text-[14px] font-medium text-[var(--fg-primary)] truncate">
                {title}
              </span>
            )}
          </div>
        )}
      </div>

      {centerContent && (
        <div className="hidden md:flex items-center justify-center flex-1 px-4">
          {centerContent}
        </div>
      )}

      <div className="flex items-center gap-2">
        {showHud && (
          <>
            <HudPill
              variant="streak"
              value={streak}
              hideValueOnMobile={false}
              aria-label={`${streak} day streak`}
            />
            <HudPill
              variant="xp"
              value={totalXp.toLocaleString()}
              hideValueOnMobile
              aria-label={`${totalXp} XP`}
            />
          </>
        )}
        {rightContent}
      </div>
    </header>
  );
}
