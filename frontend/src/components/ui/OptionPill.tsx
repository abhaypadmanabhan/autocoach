"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { buttonHoverVariants } from "@/lib/motions";
import type { ReactNode } from "react";

interface OptionPillProps {
  label: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  multiSelect?: boolean;
  className?: string;
}

export function OptionPill({
  label,
  selected = false,
  onClick,
  disabled = false,
  icon,
  multiSelect = false,
  className = "",
}: OptionPillProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      initial="initial"
      whileHover={disabled ? undefined : "hover"}
      whileTap={disabled ? undefined : "tap"}
      variants={buttonHoverVariants}
      animate={selected ? "selected" : "initial"}
      className={`
        relative px-6 py-3 rounded-full font-medium text-sm
        border transition-colors duration-300
        flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${selected
          ? "bg-brand-primary border-brand-primary text-surface-dark"
          : "bg-transparent border-surface-border text-text-primary hover:border-brand-primary/50"
        }
        ${className}
      `}
    >
      {multiSelect && selected && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Check size={14} className="text-surface-dark" />
        </motion.span>
      )}
      {icon && !multiSelect && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>
    </motion.button>
  );
}

interface OptionPillGridProps {
  options: Array<{
    value: string;
    label: string;
    icon?: ReactNode;
  }>;
  selected: string | string[];
  onSelect: (value: string) => void;
  multiSelect?: boolean;
  className?: string;
}

export function OptionPillGrid({
  options,
  selected,
  onSelect,
  multiSelect = false,
  className = "",
}: OptionPillGridProps) {
  const isSelected = (value: string) => {
    if (multiSelect) {
      return Array.isArray(selected) && selected.includes(value);
    }
    return selected === value;
  };

  const handleSelect = (value: string) => {
    onSelect(value);
  };

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {options.map((option) => (
        <OptionPill
          key={option.value}
          label={option.label}
          icon={option.icon}
          selected={isSelected(option.value)}
          onClick={() => handleSelect(option.value)}
          multiSelect={multiSelect}
        />
      ))}
    </div>
  );
}

interface DifficultyCardProps {
  level: "easy" | "medium" | "hard";
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

const difficultyConfig = {
  easy: {
    label: "Easy",
    description: "Basic concepts",
    icon: "🌱",
    color: "#22c55e",
    bgColor: "rgba(34, 197, 94, 0.1)",
  },
  medium: {
    label: "Medium",
    description: "Standard difficulty",
    icon: "🌿",
    color: "#c18c5d",
    bgColor: "rgba(193, 140, 93, 0.1)",
  },
  hard: {
    label: "Hard",
    description: "Advanced concepts",
    icon: "🔥",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.1)",
  },
};

export function DifficultyCard({
  level,
  selected = false,
  onClick,
  className = "",
}: DifficultyCardProps) {
  const config = difficultyConfig[level];

  return (
    <motion.button
      onClick={onClick}
      initial="initial"
      whileHover="hover"
      whileTap="tap"
      variants={buttonHoverVariants}
      className={`
        relative p-4 rounded-xl border-2 text-left transition-all duration-300
        flex flex-col items-center gap-2 min-w-[100px]
        ${selected
          ? "border-brand-primary bg-brand-primary/10"
          : "border-surface-border bg-surface-card hover:border-brand-primary/50"
        }
        ${className}
      `}
    >
      <motion.div
        animate={{
          scale: selected ? 1.1 : 1,
          boxShadow: selected
            ? `0 0 20px ${config.bgColor}`
            : "0 0 0px transparent",
        }}
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
        style={{ backgroundColor: config.bgColor }}
      >
        {config.icon}
      </motion.div>
      <div className="text-center">
        <p className={`font-semibold ${selected ? "text-brand-primary" : "text-text-primary"}`}>
          {config.label}
        </p>
        <p className="text-xs text-text-muted mt-0.5">{config.description}</p>
      </div>
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-brand-primary rounded-full flex items-center justify-center"
        >
          <Check size={14} className="text-surface-dark" />
        </motion.div>
      )}
    </motion.button>
  );
}
