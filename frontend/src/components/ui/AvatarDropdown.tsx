"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Settings, LogOut } from "lucide-react";
import { modalVariants, overlayVariants } from "@/lib/motions";
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Avatar Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-surface-dark font-bold cursor-pointer overflow-hidden"
        aria-label="Open user menu"
        aria-expanded={isOpen}
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
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-40 md:hidden"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute right-0 top-full mt-2 w-64 z-50 origin-top-right"
            >
              <div className="rounded-xl bg-surface-darker border border-surface-border shadow-xl overflow-hidden">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-surface-border">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {user?.email}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-surface-border text-text-muted">
                    Free Plan
                  </span>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-border/50 hover:text-text-primary transition-colors"
                  >
                    <Settings size={18} />
                    Settings
                  </Link>

                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-semantic-error hover:bg-semantic-error/10 transition-colors"
                  >
                    <LogOut size={18} />
                    Sign out
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
