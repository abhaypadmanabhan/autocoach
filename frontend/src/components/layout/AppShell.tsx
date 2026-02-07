"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { School, ArrowLeft } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { pageVariants, pageTransition } from "@/lib/motions";
import { createBrowserClient } from "@/lib/supabase/client";
import { ToastProvider } from "@/components/ui/Toast";
import { AvatarDropdown } from "@/components/ui/AvatarDropdown";
import { useAvatar } from "@/hooks/useAvatar";
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
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface-dark text-text-primary relative overflow-hidden">
        {/* Decorative top circle */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-brand-primary/5 pointer-events-none -translate-y-1/2 z-0" />

        {/* Top Navigation */}
        {showNav && (
          <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="sticky top-0 z-50 w-full backdrop-blur-md bg-surface-dark/90 border-b border-surface-border/50"
          >
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-between">
                {/* Left section */}
                <div className="flex items-center gap-4">
                  {showBack && (
                    <motion.button
                      whileHover={{ x: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleBack}
                      className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-border/50 transition-colors"
                    >
                      <ArrowLeft size={20} className="text-text-secondary" />
                    </motion.button>
                  )}

                  <Link
                    href="/dashboard"
                    className="flex items-center gap-3 group"
                  >
                    <motion.div
                      whileHover={{ scale: 1.05, rotate: 5 }}
                      className="w-10 h-10 rounded-xl bg-brand-primary/20 flex items-center justify-center"
                    >
                      <School size={22} className="text-brand-primary" />
                    </motion.div>
                    <span className="font-serif text-xl font-medium text-text-primary hidden sm:block">
                      AutoCoach
                    </span>
                  </Link>

                  {title && (
                    <>
                      <span className="text-surface-border hidden sm:inline">|</span>
                      <span className="text-text-secondary font-medium">{title}</span>
                    </>
                  )}
                </div>

                {/* Right section */}
                <div className="flex items-center gap-2">
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

        {/* Main Content Area */}
        <div className="flex h-screen pt-16">
          {/* Sidebar */}
          {sidebar && (
            <aside className="hidden lg:block w-64 border-r border-surface-border/50 bg-surface-darker/50 overflow-y-auto">
              {sidebar}
            </aside>
          )}

          {/* Main Content */}
          <motion.main
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={pageTransition}
            className={`relative z-10 flex-1 overflow-y-auto ${className} ${sidebar ? 'h-[calc(100vh-4rem)]' : ''}`}
          >
            {children}
          </motion.main>
        </div>

        {/* Bottom Navigation / Progress Bar */}
        {showBottomNav && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-surface-darker border-t border-surface-border/50"
          >
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
              {bottomNavContent}
            </div>
          </motion.div>
        )}
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
