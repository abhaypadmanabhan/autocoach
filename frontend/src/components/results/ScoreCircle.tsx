"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { scoreCircleVariants, scoreTextVariants, satelliteVariants } from "@/lib/motions";
import { Progress } from "@/components/ui/progress";
import type { ReactNode } from "react";

interface ScoreCircleProps {
  score: number;
  total: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ScoreCircle({
  score,
  total,
  label = "Score",
  size = "md",
  className = "",
}: ScoreCircleProps) {
  const percentage = Math.round((score / total) * 100);
  const [displayScore, setDisplayScore] = useState(0);
  const [countingDone, setCountingDone] = useState(false);

  // Animate the score counting up
  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = percentage / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= percentage) {
        setDisplayScore(percentage);
        clearInterval(timer);
        setCountingDone(true);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [percentage]);

  const sizeClasses = {
    sm: "w-32 h-32",
    md: "w-48 h-48",
    lg: "w-64 h-64",
  };

  const textSizes = {
    sm: "text-3xl",
    md: "text-5xl",
    lg: "text-6xl",
  };

  const strokeWidth = {
    sm: 3,
    md: 4,
    lg: 5,
  };

  const getScoreColor = () => {
    if (percentage >= 80) return "#22c55e";
    if (percentage >= 60) return "#c18c5d";
    if (percentage >= 40) return "#eab308";
    return "#ef4444";
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* Background glow — reduced opacity */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.15, scale: 1 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 rounded-full blur-3xl"
        style={{ backgroundColor: getScoreColor() }}
      />

      {/* One-shot pulse ring after counting completes */}
      {countingDone && (
        <motion.div
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 1.15 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute inset-0 rounded-full border-2 z-10"
          style={{ borderColor: getScoreColor() }}
        />
      )}

      <svg
        className={`${sizeClasses[size]} -rotate-90 relative z-10`}
        viewBox="0 0 36 36"
      >
        {/* Background circle */}
        <path
          className="text-surface-border/30"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth[size]}
        />

        {/* Score progress */}
        <motion.path
          variants={scoreCircleVariants}
          initial="hidden"
          animate="visible"
          stroke={getScoreColor()}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          strokeWidth={strokeWidth[size]}
          strokeLinecap="round"
          strokeDasharray="100"
          style={{
            strokeDashoffset: 100 - percentage,
          }}
        />
      </svg>

      {/* Center content */}
      <motion.div
        variants={scoreTextVariants}
        initial="hidden"
        animate="visible"
        className="absolute inset-0 flex flex-col items-center justify-center z-20"
      >
        <motion.span
          key={displayScore}
          initial={{ filter: "blur(4px)" }}
          animate={{ filter: "blur(0px)" }}
          className={`${textSizes[size]} font-bold text-text-primary`}
        >
          {displayScore}%
        </motion.span>
        <span className="text-text-muted text-sm uppercase tracking-wider mt-1">
          {label}
        </span>
      </motion.div>
    </div>
  );
}

// ============================================
// InlineStats — compact replacement for ScoreBreakdown
// ============================================

interface InlineStatsProps {
  correct: number;
  total: number;
  className?: string;
}

function getScoreTierColor(percent: number) {
  if (percent >= 80) return "bg-[#22c55e]";
  if (percent >= 60) return "bg-[#c18c5d]";
  if (percent >= 40) return "bg-[#eab308]";
  return "bg-[#ef4444]";
}

export function InlineStats({ correct, total, className = "" }: InlineStatsProps) {
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className={`space-y-2 ${className}`}
    >
      <p className="text-sm font-medium text-[var(--text-secondary)]">
        <span className="text-lg font-bold text-[var(--text-primary)]">{correct}</span>
        {" "}of{" "}
        <span className="text-lg font-bold text-[var(--text-primary)]">{total}</span>
        {" "}correct
      </p>
      <Progress
        value={percent}
        className="h-2.5 w-full max-w-xs bg-[var(--surface-border)]/30"
        indicatorClassName={getScoreTierColor(percent)}
      />
    </motion.div>
  );
}

// ============================================
// StatSatellite — kept for backward compat
// ============================================

interface StatSatelliteProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  orbitDelay?: number;
  className?: string;
}

export function StatSatellite({
  icon,
  label,
  value,
  orbitDelay = 0,
  className = "",
}: StatSatelliteProps) {
  return (
    <motion.div
      custom={orbitDelay}
      variants={satelliteVariants}
      initial="hidden"
      animate="visible"
      className={`
        flex flex-col items-center gap-2
        p-4 rounded-2xl bg-surface-card border border-surface-border
        ${className}
      `}
    >
      <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
        {icon}
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-text-primary">{value}</p>
        <p className="text-xs text-text-muted uppercase tracking-wider">{label}</p>
      </div>
    </motion.div>
  );
}

// ============================================
// ScoreBreakdown — kept for backward compat
// ============================================

interface ScoreBreakdownProps {
  correct: number;
  incorrect: number;
  total: number;
  timeTaken?: string;
  className?: string;
}

export function ScoreBreakdown({
  correct,
  incorrect,
  total,
  timeTaken,
  className = "",
}: ScoreBreakdownProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${className}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-center p-4 rounded-xl bg-surface-card border border-surface-border"
      >
        <p className="text-2xl font-bold" style={{ color: "#22c55e" }}>
          {correct}
        </p>
        <p className="text-xs text-text-muted uppercase tracking-wider mt-1">
          Correct
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center p-4 rounded-xl bg-surface-card border border-surface-border"
      >
        <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>
          {incorrect}
        </p>
        <p className="text-xs text-text-muted uppercase tracking-wider mt-1">
          Wrong
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-center p-4 rounded-xl bg-surface-card border border-surface-border"
      >
        <p className="text-2xl font-bold" style={{ color: "#cd776a" }}>
          {total}
        </p>
        <p className="text-xs text-text-muted uppercase tracking-wider mt-1">
          Total
        </p>
      </motion.div>

      {timeTaken && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center p-4 rounded-xl bg-surface-card border border-surface-border"
        >
          <p className="text-2xl font-bold" style={{ color: "#c18c5d" }}>
            {timeTaken}
          </p>
          <p className="text-xs text-text-muted uppercase tracking-wider mt-1">
            Time
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
