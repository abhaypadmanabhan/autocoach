"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Settings, LogOut } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface AvatarDropdownProps {
  user: User | null;
  avatarUrl?: string | null;
  onLogout: () => void;
}

function getInitials(email: string | undefined): string {
  if (!email) return "?";
  return email.slice(0, 2).toUpperCase();
}

export function AvatarDropdown({
  user,
  avatarUrl,
  onLogout,
}: AvatarDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on click outside — use `click` (not mousedown)
  // so it doesn't race with button click handlers
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    // Use a rAF to avoid closing on the same click that opened it
    const id = requestAnimationFrame(() => {
      document.addEventListener("click", handleClickOutside, true);
      document.addEventListener("keydown", handleEscape);
    });

    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("click", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Avatar Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen((v) => !v)}
        disabled={isLoggingOut}
        className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-secondary)] flex items-center justify-center text-[var(--surface-dark)] font-bold cursor-pointer overflow-hidden ring-2 ring-transparent hover:ring-[var(--brand-primary)]/30 transition-all"
        aria-label="Open user menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt="User avatar"
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm">{getInitials(user?.email)}</span>
        )}
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/20 md:hidden"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              key="menu"
              ref={menuRef}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 top-full mt-2 w-64 z-50"
            >
              <div className="rounded-xl bg-[var(--surface-darker)] border border-[var(--surface-border)] shadow-2xl overflow-hidden">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {user?.email}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-[var(--surface-border)] text-[var(--text-muted)]">
                    Free Plan
                  </span>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      router.push("/settings");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-border)]/50 hover:text-[var(--text-primary)] transition-colors cursor-pointer text-left"
                  >
                    <Settings size={18} />
                    Settings
                  </button>

                  <button
                    type="button"
                    disabled={isLoggingOut}
                    onClick={() => {
                      setIsLoggingOut(true);
                      setIsOpen(false);
                      Promise.resolve(onLogout()).finally(() => setIsLoggingOut(false));
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50 text-left"
                  >
                    <LogOut size={18} />
                    {isLoggingOut ? "Signing out..." : "Sign out"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
