"use client";

import { motion } from "framer-motion";
import { diamondVariants, diamondTransition } from "@/lib/motions";
import type { ReactNode } from "react";

interface DiamondButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "outline";
}

export function DiamondButton({
  children,
  onClick,
  disabled = false,
  className = "",
  size = "md",
  variant = "primary",
}: DiamondButtonProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const variantClasses = {
    primary: "bg-brand-primary",
    secondary: "bg-surface-border",
    outline: "bg-transparent border-2 border-brand-primary",
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      initial="idle"
      whileHover={disabled ? undefined : "hover"}
      whileTap={disabled ? undefined : "tap"}
      variants={diamondVariants}
      transition={diamondTransition}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        flex items-center justify-center
        cursor-pointer disabled:cursor-not-allowed disabled:opacity-50
        ${className}
      `}
      style={{ transform: "rotate(0deg)" }}
    >
      <span className="flex items-center justify-center" style={{ transform: "rotate(0deg)" }}>
        {children}
      </span>
    </motion.button>
  );
}

interface DiamondSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function DiamondSpinner({ size = "md", className = "" }: DiamondSpinnerProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      className={`
        ${sizeClasses[size]}
        border-2 border-brand-primary
        flex items-center justify-center
        ${className}
      `}
      style={{ transform: "rotate(45deg)" }}
    >
      <div className="w-1/2 h-1/2 bg-brand-primary/30" />
    </motion.div>
  );
}

interface DiamondMarkerProps {
  active?: boolean;
  completed?: boolean;
  onClick?: () => void;
  className?: string;
}

export function DiamondMarker({
  active = false,
  completed = false,
  onClick,
  className = "",
}: DiamondMarkerProps) {
  return (
    <motion.div
      onClick={onClick}
      initial={false}
      animate={{
        rotate: active || completed ? 45 : 0,
        scale: active ? 1.1 : 1,
        backgroundColor: completed
          ? "var(--brand-primary)"
          : active
            ? "var(--brand-primary)"
            : "transparent",
        borderColor: completed || active
          ? "var(--brand-primary)"
          : "var(--surface-border)",
      }}
      transition={diamondTransition}
      className={`
        w-4 h-4 border-2 cursor-pointer
        ${className}
      `}
    >
      {completed && (
        <motion.svg
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          className="w-full h-full p-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: "rotate(-45deg)" }}
        >
          <motion.path
            d="M5 12l5 5L20 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3 }}
          />
        </motion.svg>
      )}
    </motion.div>
  );
}
