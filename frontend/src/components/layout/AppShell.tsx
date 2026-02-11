"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Flame, Trophy, Loader2, Zap, Calendar } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { pageVariants, pageTransition } from "@/lib/motions";
import { createBrowserClient } from "@/lib/supabase/client";
import { ToastProvider } from "@/components/ui/Toast";
import { AvatarDropdown } from "@/components/ui/AvatarDropdown";
import { useAvatar } from "@/hooks/useAvatar";
import { useUserStats } from "@/hooks/useDailySprint";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  showNav?: boolean;
  showBack?: boolean;
  backHref?: string;
  title?: string;
  rightContent?: ReactNode;
  showBottomNav?: boolean;
  bottomNavContent?: ReactNode;
  sidebar?: ReactNode;
  className?: string;
  showStatsHUD?: boolean;
}

// Animated Background Component
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Primary gradient orb - top */}
      <motion.div
        className="absolute w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full opacity-[0.08]"
        style={{
          background: "radial-gradient(circle, var(--brand-primary) 0%, transparent 70%)",
          top: "-20%",
          left: "50%",
          x: "-50%",
        }}
        animate={{
          scale: [1, 1.1, 1],
          x: ["-50%", "-48%", "-52%", "-50%"],
          y: [0, 20, -10, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Secondary gradient orb - bottom */}
      <motion.div
        className="absolute w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] rounded-full opacity-[0.05]"
        style={{
          background: "radial-gradient(circle, var(--brand-secondary) 0%, transparent 70%)",
          bottom: "-10%",
          right: "-5%",
        }}
        animate={{
          scale: [1, 1.15, 1],
          x: [0, -30, 20, 0],
          y: [0, -20, 30, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(var(--surface-border) 1px, transparent 1px),
            linear-gradient(90deg, var(--surface-border) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}

// Stats HUD Component - Functional with tooltips
function StatsHUD({ className }: { className?: string }) {
  const { streak, totalXp, xpEarnedToday, completedToday, isLoading } = useUserStats();
  const [activeTooltip, setActiveTooltip] = useState<"streak" | "xp" | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = (type: "streak" | "xp") => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setActiveTooltip(type);
  };

  const hideTooltip = () => {
    tooltipTimeoutRef.current = setTimeout(() => setActiveTooltip(null), 200);
  };

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <Loader2 className="w-4 h-4 text-[var(--text-muted)] animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Streak */}
      <div className="relative">
        <motion.div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 cursor-default select-none"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400 }}
          onMouseEnter={() => showTooltip("streak")}
          onMouseLeave={hideTooltip}
          onClick={() => setActiveTooltip(activeTooltip === "streak" ? null : "streak")}
        >
          <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
          <span className="text-sm font-bold text-orange-500">{streak}</span>
          <span className="text-[10px] font-medium text-orange-400/70 uppercase tracking-wide hidden md:inline">day{streak !== 1 ? "s" : ""}</span>
        </motion.div>

        <AnimatePresence>
          {activeTooltip === "streak" && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-52"
              onMouseEnter={() => showTooltip("streak")}
              onMouseLeave={hideTooltip}
            >
              <div className="bg-[var(--surface-darker)] border border-[var(--surface-border)] rounded-xl p-3 shadow-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Daily Streak</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {streak === 0
                    ? "Complete a daily sprint to start your streak!"
                    : `You've studied ${streak} day${streak !== 1 ? "s" : ""} in a row. ${completedToday ? "Today's sprint is done!" : "Complete today's sprint to keep it going!"}`
                  }
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* XP */}
      <div className="relative">
        <motion.div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 cursor-default select-none"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400 }}
          onMouseEnter={() => showTooltip("xp")}
          onMouseLeave={hideTooltip}
          onClick={() => setActiveTooltip(activeTooltip === "xp" ? null : "xp")}
        >
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-bold text-yellow-500">{totalXp.toLocaleString()}</span>
          <span className="text-[10px] font-medium text-yellow-400/70 uppercase tracking-wide hidden md:inline">XP</span>
        </motion.div>

        <AnimatePresence>
          {activeTooltip === "xp" && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full mt-2 right-0 z-50 w-52"
              onMouseEnter={() => showTooltip("xp")}
              onMouseLeave={hideTooltip}
            >
              <div className="bg-[var(--surface-darker)] border border-[var(--surface-border)] rounded-xl p-3 shadow-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Experience Points</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--text-muted)]">Total XP</span>
                    <span className="text-yellow-400 font-semibold">{totalXp.toLocaleString()}</span>
                  </div>
                  {xpEarnedToday > 0 && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[var(--text-muted)]">Earned today</span>
                      <span className="text-emerald-400 font-semibold">+{xpEarnedToday}</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mt-2 leading-relaxed">
                  Earn XP by completing quizzes and daily sprints.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  showNav = true,
  showBack = false,
  backHref,
  title,
  rightContent,
  showBottomNav = false,
  bottomNavContent,
  sidebar,
  className = "",
  showStatsHUD = true,
}: AppShellProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const { avatarUrl } = useAvatar(user?.id ?? null);

  useEffect(() => {
    const supabase = createBrowserClient();

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  const handleLogout = async () => {
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      setUser(null);
      router.replace("/login");
      router.refresh();
    } catch {
      // Force redirect even on error
      window.location.href = "/login";
    }
  };

  return (
    <ToastProvider>
      <div className="flex h-screen w-full bg-[var(--surface-dark)] text-[var(--text-primary)] overflow-hidden relative">
        {/* Animated Background */}
        <AnimatedBackground />

        {/* Sidebar (Left, Full Height) */}
        {sidebar && (
          <aside className="hidden lg:flex w-64 flex-col flex-shrink-0 border-r border-[var(--surface-border)]/50 bg-[var(--surface-darker)]/80 backdrop-blur-xl h-full z-20 relative">
            {sidebar}
          </aside>
        )}

        {/* Main Content Column (Right) */}
        <div className="flex-1 flex flex-col min-w-0 h-full z-10 relative">

          {/* Top Navigation */}
          {showNav && (
            <motion.header
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="h-16 shrink-0 w-full backdrop-blur-xl bg-[var(--surface-dark)]/80 border-b border-[var(--surface-border)]/50 flex flex-col justify-center z-30 relative"
            >
              <div className="w-full px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between">
                  {/* Left section */}
                  <div className="flex items-center gap-3">
                    {showBack && (
                      <motion.button
                        whileHover={{ x: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleBack}
                        className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-[var(--surface-card)] transition-colors"
                      >
                        <ArrowLeft size={18} className="text-[var(--text-secondary)]" />
                      </motion.button>
                    )}

                    {title && (
                      <span className="text-[var(--text-primary)] font-semibold text-sm tracking-wide">{title}</span>
                    )}

                    {/* Stats HUD on mobile - visible only on small screens */}
                    {showStatsHUD && user && (
                      <StatsHUD className="flex sm:hidden" />
                    )}
                  </div>

                  {/* Right section */}
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Stats HUD - Always visible when logged in */}
                    {showStatsHUD && user && (
                      <StatsHUD className="hidden sm:flex" />
                    )}

                    {rightContent}

                    <AvatarDropdown
                      user={user}
                      avatarUrl={avatarUrl}
                      onLogout={handleLogout}
                    />
                  </div>
                </div>
              </div>
            </motion.header>
          )}

          {/* Main Scrollable Content */}
          <motion.main
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={pageTransition}
            className={`flex-1 overflow-y-auto relative ${className}`}
          >
            {children}
          </motion.main>

          {/* Bottom Navigation / Progress Bar */}
          {showBottomNav && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mt-auto bg-[var(--surface-darker)] border-t border-[var(--surface-border)]/50 shrink-0"
            >
              <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                {bottomNavContent}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </ToastProvider>
  );
}

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

export function PageContainer({
  children,
  className = "",
  size = "lg",
}: PageContainerProps) {
  const sizeClasses = {
    sm: "max-w-[600px]",
    md: "max-w-[800px]",
    lg: "max-w-[1000px]",
    xl: "max-w-[1200px]",
    full: "max-w-none",
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        mx-auto px-4 sm:px-6 lg:px-8 xl:px-12
        py-8 sm:py-12 lg:py-16
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface SectionProps {
  children: ReactNode;
  className?: string;
  spacing?: "sm" | "md" | "lg";
}

export function Section({
  children,
  className = "",
  spacing = "md",
}: SectionProps) {
  const spacingClasses = {
    sm: "my-8",
    md: "my-12 lg:my-16",
    lg: "my-16 lg:my-24",
  };

  return (
    <section className={`${spacingClasses[spacing]} ${className}`}>
      {children}
    </section>
  );
}
